/**
 * MarketCreationScreen — mobile market creation wizard (GH #80).
 *
 * Matches web wizard flow:
 *  Step 1 — Token mint address input (auto-detects name/symbol from /api/launch)
 *  Step 2 — Slab tier picker with SOL cost breakdown
 *  Step 3 — Oracle mode (auto-detected from DEX pool, or admin fallback)
 *  Deploy  — 5-step progress via useCreateMarket → /api/mobile/create-market
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { Panel } from '../components/ui/Panel';
import { InputField } from '../components/ui/InputField';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { useMWA } from '../hooks/useMWA';
import { useCreateMarket, type SlabTier } from '../hooks/useCreateMarket';

/* ── Types ───────────────────────────────────────────────────────── */

interface TokenMeta {
  name: string;
  symbol: string;
  decimals: number;
  estimatedRentSol: string;
  pool: { pairLabel: string; liquidityUsd: number; priceUsd: number } | null;
  oracle_mode: 'admin' | 'hyperp' | 'pyth';
  dex_pool_address: string | null;
  initial_price_e6: string;
}

// BUG-5 fix: 5-step wizard matching web flow.
// Steps: mint → tier → oracle → review → (deploying) → done
type WizardStep = 'mint' | 'tier' | 'oracle' | 'review' | 'deploying' | 'done';

/* ── Tier config ─────────────────────────────────────────────────── */

interface TierOption {
  key: SlabTier;
  label: string;
  maxAccounts: number;
  rentSol: string;
  desc: string;
}

// BUG-3 fix: tier labels must match the web wizard (Small / Medium / Large).
const TIER_OPTIONS: TierOption[] = [
  {
    key: 'small',
    label: 'Small',
    maxAccounts: 256,
    rentSol: '~0.44',
    desc: 'Great for testing. 256 max trader accounts.',
  },
  {
    key: 'medium',
    label: 'Medium',
    maxAccounts: 1024,
    rentSol: '~1.8',
    desc: 'Mid-scale markets. 1,024 max trader accounts.',
  },
  {
    key: 'large',
    label: 'Large',
    maxAccounts: 4096,
    rentSol: '~7',
    desc: 'Full production scale. 4,096 max trader accounts.',
  },
];

const WEB_API_BASE =
  process.env.EXPO_PUBLIC_WEB_URL ?? 'https://percolatorlaunch.com/api';

/* ── Step progress bar ───────────────────────────────────────────── */

const DEPLOY_STEPS = [
  'Building txs…',
  'Create slab & init market',
  'Oracle setup & crank',
  'Init LP',
  'Deposit & insurance',
  'Insurance mint',
];

function DeployProgress({ stepIndex }: { stepIndex: number }) {
  return (
    <View style={styles.progressContainer}>
      {DEPLOY_STEPS.map((label, i) => {
        const done = i < stepIndex;
        const active = i === stepIndex;
        return (
          <View key={i} style={styles.progressRow}>
            <View
              style={[
                styles.progressDot,
                done && styles.progressDotDone,
                active && styles.progressDotActive,
              ]}
            >
              {done ? (
                <Text style={styles.progressCheck}>✓</Text>
              ) : active ? (
                <ActivityIndicator size="small" color="#000" style={{ transform: [{ scale: 0.6 }] }} />
              ) : null}
            </View>
            <Text
              style={[
                styles.progressLabel,
                done && styles.progressLabelDone,
                active && styles.progressLabelActive,
              ]}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/* ── Main screen ─────────────────────────────────────────────────── */

export function MarketCreationScreen() {
  const { connected, connect, connecting } = useMWA();
  const { state: deployState, deploy, reset } = useCreateMarket();

  const [wizardStep, setWizardStep] = useState<WizardStep>('mint');
  const [mintInput, setMintInput] = useState('');
  const [marketName, setMarketName] = useState('');
  const [selectedTier, setSelectedTier] = useState<SlabTier>('small');
  const [tokenMeta, setTokenMeta] = useState<TokenMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  // Sync wizard to deploying/done states
  useEffect(() => {
    if (deployState.deploying) setWizardStep('deploying');
    if (deployState.txSignature) setWizardStep('done');
  }, [deployState.deploying, deployState.txSignature]);

  // Auto-detect token metadata when mint changes (debounced)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleMintChange = useCallback((text: string) => {
    setMintInput(text);
    setTokenMeta(null);
    setMetaError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 32) return; // Solana pubkeys are 32+ chars

    debounceRef.current = setTimeout(async () => {
      setMetaLoading(true);
      try {
        const res = await fetch(`${WEB_API_BASE}/launch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mint: text.trim(), slabTier: selectedTier }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const cfg = await res.json();
        const meta: TokenMeta = {
          name: cfg.name ?? 'Unknown',
          symbol: cfg.symbol ?? '???',
          decimals: cfg.decimals ?? 6,
          estimatedRentSol: cfg.estimatedRentSol ?? '?',
          pool: cfg.pool,
          oracle_mode: cfg.pool ? 'hyperp' : 'admin',
          dex_pool_address: cfg.pool?.poolAddress ?? null,
          initial_price_e6: cfg.initialPriceE6 ?? '1000000',
        };
        setTokenMeta(meta);
        // BUG-4: guard against auto-populating with a raw mint address or junk.
        // A valid ticker starts with a letter and is short (≤12 chars).
        const symbolOk = /^[A-Za-z][A-Za-z0-9]{0,11}$/.test(meta.symbol ?? '');
        const safeSymbol = symbolOk ? meta.symbol : 'UNKNOWN';
        if (!marketName || marketName === tokenMeta?.name || marketName === tokenMeta?.symbol) {
          setMarketName(`${safeSymbol}-PERP`);
        }
      } catch (e) {
        setMetaError(e instanceof Error ? e.message : 'Failed to fetch token info');
      } finally {
        setMetaLoading(false);
      }
    }, 600);
  }, [selectedTier, marketName, tokenMeta]);

  const handleDeploy = useCallback(() => {
    if (!connected || !mintInput.trim() || !marketName.trim()) return;
    deploy({
      mint: mintInput.trim(),
      name: marketName.trim(),
      tier: selectedTier,
      // Force admin oracle on devnet — hyperp uses mainnet pool addresses
      oracle_mode: 'admin',
      initial_price_e6: tokenMeta?.initial_price_e6 ?? '1000000',
    });
  }, [connected, mintInput, marketName, selectedTier, tokenMeta, deploy]);

  const handleReset = useCallback(() => {
    reset();
    setWizardStep('mint');
    setMintInput('');
    setMarketName('');
    setTokenMeta(null);
    setMetaError(null);
    setSelectedTier('small');
  }, [reset]);

  /* ── Render: Done ──────────────────────────────────────────────── */
  if (wizardStep === 'done') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Market Created 🎉</Text>
        </View>
        <View style={styles.doneContainer}>
          <Text style={styles.doneIcon}>✅</Text>
          <Text style={styles.doneTitle}>{marketName} is live on devnet</Text>
          {deployState.slabAddress && (
            <Text style={styles.doneAddress}>
              Slab: {deployState.slabAddress.slice(0, 16)}…
            </Text>
          )}
          {deployState.txSignature && (
            <Text style={styles.doneTx}>
              Tx: {deployState.txSignature.slice(0, 20)}…
            </Text>
          )}
          <TouchableOpacity style={styles.primaryBtn} onPress={handleReset} activeOpacity={0.8}>
            <Text style={styles.primaryBtnText}>Create Another Market</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Render: Deploying ─────────────────────────────────────────── */
  if (wizardStep === 'deploying') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Deploying Market…</Text>
        </View>
        {deployState.error ? (
          <View style={styles.content}>
            <ErrorBanner message={deployState.error} />
            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 16 }]}
              onPress={() => setWizardStep('review')}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.content}>
            <DeployProgress stepIndex={deployState.stepIndex} />
            <Text style={styles.stepDetail}>{deployState.step}</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  /* ── Render: Wizard ────────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Create Market</Text>
        {/* BUG-5: 5-step indicator matching web (mint → tier → oracle → review → deploy) */}
        <View style={styles.stepIndicator}>
          {(['mint', 'tier', 'oracle', 'review', 'deploying'] as const).map((s, i) => {
            const STEPS = ['mint', 'tier', 'oracle', 'review', 'deploying'];
            const currentIdx = STEPS.indexOf(wizardStep);
            const isDone = i < currentIdx;
            const isActive = s === wizardStep;
            return (
              <View
                key={s}
                style={[
                  styles.stepDot,
                  isActive && styles.stepDotActive,
                  isDone && styles.stepDotDone,
                ]}
              />
            );
          })}
        </View>
      </View>

      {deployState.error && <ErrorBanner message={deployState.error} />}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Step 1: Mint input ─────────────────────────────── */}
        {wizardStep === 'mint' && (
          <>
            <Text style={styles.sectionTitle}>Token Mint Address</Text>
            <Text style={styles.sectionDesc}>
              Paste the Solana SPL token mint address for your perpetual market.
            </Text>
            <InputField
              label="Mint Address"
              value={mintInput}
              onChangeText={handleMintChange}
              placeholder="e.g. So11111111111111111111111111111111111111112"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {metaLoading && (
              <View style={styles.metaRow}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.metaLoading}>Detecting token…</Text>
              </View>
            )}

            {metaError && (
              <Text style={styles.metaError}>{metaError}</Text>
            )}

            {tokenMeta && !metaLoading && (
              <Panel style={styles.tokenCard}>
                <Text style={styles.tokenSymbol}>{tokenMeta.symbol}</Text>
                <Text style={styles.tokenName}>{tokenMeta.name}</Text>
                <View style={styles.tokenMetaRow}>
                  <Text style={styles.tokenMetaLabel}>Decimals</Text>
                  <Text style={styles.tokenMetaValue}>{tokenMeta.decimals}</Text>
                </View>
                {tokenMeta.pool ? (
                  <View style={styles.tokenMetaRow}>
                    <Text style={styles.tokenMetaLabel}>Pool detected</Text>
                    <Text style={[styles.tokenMetaValue, { color: colors.long }]}>
                      ✓ {tokenMeta.pool.pairLabel}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.tokenMetaRow}>
                    <Text style={styles.tokenMetaLabel}>Oracle</Text>
                    <Text style={styles.tokenMetaValue}>Admin (devnet default)</Text>
                  </View>
                )}
                {tokenMeta.pool && (
                  <View style={styles.tokenMetaRow}>
                    <Text style={styles.tokenMetaLabel}>Initial price</Text>
                    <Text style={styles.tokenMetaValue}>
                      ${(Number(tokenMeta.initial_price_e6) / 1_000_000).toFixed(4)}
                    </Text>
                  </View>
                )}
              </Panel>
            )}

            {/* BUG-4 fix: market name moved to oracle step so it can't show as mint addr */}

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (!mintInput.trim() || metaLoading) && styles.primaryBtnDisabled,
              ]}
              onPress={() => setWizardStep('tier')}
              disabled={!mintInput.trim() || metaLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>Next: Choose Tier →</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Step 2: Tier picker ────────────────────────────── */}
        {wizardStep === 'tier' && (
          <>
            <Text style={styles.sectionTitle}>Slab Tier</Text>
            <Text style={styles.sectionDesc}>
              Choose how many trader accounts your market supports. More accounts = higher
              SOL rent cost.
            </Text>

            {TIER_OPTIONS.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.tierCard, selectedTier === t.key && styles.tierCardActive]}
                onPress={() => setSelectedTier(t.key)}
                activeOpacity={0.8}
              >
                <View style={styles.tierCardHeader}>
                  <View style={styles.tierRadio}>
                    {selectedTier === t.key && <View style={styles.tierRadioInner} />}
                  </View>
                  <Text style={styles.tierLabel}>{t.label}</Text>
                  <Text style={styles.tierRent}>{t.rentSol} SOL</Text>
                </View>
                <Text style={styles.tierDesc}>{t.desc}</Text>

                {/* Cost breakdown */}
                <View style={styles.costTable}>
                  <View style={styles.costRow}>
                    <Text style={styles.costLabel}>Slab rent</Text>
                    <Text style={styles.costValue}>{t.rentSol} SOL</Text>
                  </View>
                  <View style={styles.costRow}>
                    <Text style={styles.costLabel}>Vault seed</Text>
                    <Text style={styles.costValue}>500 tokens</Text>
                  </View>
                  <View style={styles.costRow}>
                    <Text style={styles.costLabel}>LP collateral</Text>
                    <Text style={styles.costValue}>1,000 tokens</Text>
                  </View>
                  <View style={styles.costRow}>
                    <Text style={styles.costLabel}>Insurance seed</Text>
                    <Text style={styles.costValue}>100 tokens</Text>
                  </View>
                  <View style={styles.costRow}>
                    <Text style={styles.costLabel}>Network fees</Text>
                    <Text style={styles.costValue}>~0.01 SOL</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            <View style={styles.navRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setWizardStep('mint')}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, styles.primaryBtnFlex]}
                onPress={() => setWizardStep('oracle')}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>Next: Oracle →</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Step 3: Oracle & Market Name ──────────────────── */}
        {/* BUG-4 fix: market name lives here, isolated from the mint address field */}
        {wizardStep === 'oracle' && (
          <>
            <Text style={styles.sectionTitle}>Oracle & Market Name</Text>
            <Text style={styles.sectionDesc}>
              Confirm the oracle source and set a display name for your market.
            </Text>

            <Panel style={styles.reviewPanel}>
              <ReviewRow
                label="Oracle mode"
                value={tokenMeta?.pool ? '✓ Hyperp DEX pool' : 'Admin (devnet default)'}
              />
              {tokenMeta?.pool && (
                <ReviewRow label="Pool" value={tokenMeta.pool.pairLabel} />
              )}
              {tokenMeta && (
                <ReviewRow
                  label="Initial price"
                  value={`$${(Number(tokenMeta.initial_price_e6) / 1_000_000).toFixed(4)}`}
                />
              )}
            </Panel>

            {/* Market name input — separate from mint field to prevent confusion */}
            <InputField
              label="Market Name"
              value={marketName}
              onChangeText={setMarketName}
              placeholder="e.g. SOL-PERP"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={64}
            />

            <View style={styles.navRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setWizardStep('tier')}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  styles.primaryBtnFlex,
                  !marketName.trim() && styles.primaryBtnDisabled,
                ]}
                onPress={() => setWizardStep('review')}
                disabled={!marketName.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>Review →</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Step 4: Review & deploy ────────────────────────── */}
        {wizardStep === 'review' && (
          <>
            <Text style={styles.sectionTitle}>Review & Deploy</Text>

            <Panel style={styles.reviewPanel}>
              <ReviewRow label="Market name" value={marketName} />
              <ReviewRow
                label="Mint"
                value={`${mintInput.slice(0, 8)}…${mintInput.slice(-6)}`}
              />
              <ReviewRow
                label="Tier"
                value={TIER_OPTIONS.find((t) => t.key === selectedTier)?.label ?? selectedTier}
              />
              <ReviewRow label="Oracle mode" value="Admin (devnet)" />
              {tokenMeta && (
                <ReviewRow
                  label="Initial price"
                  value={`$${(Number(tokenMeta.initial_price_e6) / 1_000_000).toFixed(4)}`}
                />
              )}
            </Panel>

            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ Your wallet must hold enough tokens for vault seed (500), LP collateral
                (1,000), and insurance (100) — plus SOL for slab rent. Make sure your wallet is
                funded before deploying.
              </Text>
            </View>

            {!connected ? (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={connect}
                disabled={connecting}
                activeOpacity={0.8}
              >
                {connecting ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Connect Wallet 🔗</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleDeploy}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>Deploy Market 🚀</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.secondaryBtn, { alignSelf: 'center' }]}
              onPress={() => setWizardStep('oracle')}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryBtnText}>← Back</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Helper: review row ──────────────────────────────────────────── */
function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

/* ── Styles ──────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgVoid },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  stepIndicator: { flexDirection: 'row', gap: 6 },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  stepDotActive: { backgroundColor: colors.accent, width: 20 },
  stepDotDone: { backgroundColor: colors.long },

  scroll: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },

  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  sectionDesc: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: -8,
  },

  /* Token metadata */
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaLoading: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  metaError: { fontFamily: fonts.body, fontSize: 13, color: colors.short },

  tokenCard: { gap: 8 },
  tokenSymbol: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  tokenName: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: -8,
  },
  tokenMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  tokenMetaLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tokenMetaValue: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  /* Tier picker */
  tierCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    padding: 14,
    gap: 8,
  },
  tierCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.bgOverlay,
  },
  tierCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tierRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierRadioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.accent,
  },
  tierLabel: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  tierRent: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  tierDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },

  costTable: { gap: 4, marginTop: 4 },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  costLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
  },
  costValue: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  /* Review */
  reviewPanel: { gap: 10 },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  reviewValue: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },

  warningBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: 12,
  },
  warningText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.warning,
    lineHeight: 17,
  },

  /* Deploy progress */
  progressContainer: { gap: 12, paddingVertical: 8 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotDone: {
    borderColor: colors.long,
    backgroundColor: colors.long,
  },
  progressDotActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  progressCheck: { fontSize: 12, color: '#000', fontWeight: '700' },
  progressLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  progressLabelDone: { color: colors.long },
  progressLabelActive: { color: colors.text, fontWeight: '600' },
  stepDetail: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },

  /* Done */
  doneContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 24,
  },
  doneIcon: { fontSize: 48 },
  doneTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.long,
    textAlign: 'center',
  },
  doneAddress: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
  },
  doneTx: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
  },

  /* Buttons */
  primaryBtn: {
    backgroundColor: colors.accent,
    height: 52,
    borderRadius: radii.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnFlex: { flex: 1 },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  secondaryBtn: {
    height: 44,
    borderRadius: radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },

  navRow: { flexDirection: 'row', gap: 10 },
});
