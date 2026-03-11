/**
 * MarketCreationScreen — mobile market creation wizard.
 *
 * Copy/flow parity with web CreateMarketWizard (Quick mode):
 *  Step 1 — Token: Mint address input + auto-detect metadata
 *  Step 2 — Slab Tier: tier picker with SOL cost breakdown + oracle auto-detection
 *  Step 3 — Review: market preview, cost breakdown, tx steps, launch button
 *
 * Web quick mode skips Oracle + Parameters (auto-resolved) and jumps 1→2→4.
 * Mobile mirrors this as a 3-visible-step flow (Token → Slab Tier → Review).
 * The step indicator shows "Step X of 3" matching the actual mobile UX.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
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

// 3 visible wizard steps + deploying + done
type WizardStep = 'token' | 'slab-tier' | 'review' | 'deploying' | 'done';

/* ── Step labels (match web quick mode) ──────────────────────────── */
const STEP_LABELS = ['Token', 'Slab Tier', 'Review'] as const;
const VISIBLE_STEPS: WizardStep[] = ['token', 'slab-tier', 'review'];

function stepIndex(step: WizardStep): number {
  const idx = VISIBLE_STEPS.indexOf(step);
  return idx >= 0 ? idx : -1;
}

/* ── Tier config (match web SLAB_TIERS) ──────────────────────────── */

interface TierOption {
  key: SlabTier;
  label: string;
  maxAccounts: number;
  rentSol: string;
  desc: string;
}

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

/* ── Transaction steps (match web StepReview TX_STEPS) ───────────── */

const TX_STEPS = [
  { label: 'Create slab & initialize market', detail: 'Atomic — rolls back if any part fails' },
  { label: 'Oracle setup & crank', detail: 'Configure price feed, first crank' },
  { label: 'Initialize LP', detail: 'Create liquidity provider pool' },
  { label: 'Deposit, insurance & finalize', detail: 'Seed capital + insurance fund' },
  { label: 'Insurance LP mint', detail: 'Enable permissionless insurance deposits' },
];

/* ── Deploy progress (match web LaunchProgress) ──────────────────── */

function DeployProgress({ stepIndex: si }: { stepIndex: number }) {
  return (
    <View style={styles.progressContainer}>
      {TX_STEPS.map((step, i) => {
        const done = i < si;
        const active = i === si;
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
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.progressLabel,
                  done && styles.progressLabelDone,
                  active && styles.progressLabelActive,
                ]}
              >
                {step.label}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ── Step indicator (match web WizardProgress mobile breakpoint) ── */

function StepIndicator({ current }: { current: WizardStep }) {
  const idx = stepIndex(current);
  if (idx < 0) return null;

  return (
    <View style={styles.stepIndicatorRow}>
      <Text style={styles.stepIndicatorText}>
        Step {idx + 1} of {STEP_LABELS.length} — {STEP_LABELS[idx]}
      </Text>
      <View style={styles.stepDots}>
        {STEP_LABELS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.stepDot,
              i < idx && styles.stepDotDone,
              i === idx && styles.stepDotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

/* ── Review row helper ───────────────────────────────────────────── */

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

/* ── Main screen ─────────────────────────────────────────────────── */

export function MarketCreationScreen() {
  const { connected, connect, connecting } = useMWA();
  const { state: deployState, deploy, reset } = useCreateMarket();

  const [wizardStep, setWizardStep] = useState<WizardStep>('token');
  const [mintInput, setMintInput] = useState('');
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

    if (text.trim().length < 32) return;

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
      } catch (e) {
        setMetaError(e instanceof Error ? e.message : 'Failed to fetch token info');
      } finally {
        setMetaLoading(false);
      }
    }, 600);
  }, [selectedTier]);

  // Auto-generated market name (match web: SYMBOL-PERP)
  const marketName = tokenMeta
    ? (() => {
        const symbolOk = /^[A-Za-z][A-Za-z0-9]{0,11}$/.test(tokenMeta.symbol ?? '');
        return `${symbolOk ? tokenMeta.symbol : 'UNKNOWN'}-PERP`;
      })()
    : '';

  const handleDeploy = useCallback(() => {
    if (!connected || !mintInput.trim()) return;
    deploy({
      mint: mintInput.trim(),
      name: marketName || `${mintInput.trim().slice(0, 6)}-PERP`,
      tier: selectedTier,
      oracle_mode: 'admin',
      initial_price_e6: tokenMeta?.initial_price_e6 ?? '1000000',
    });
  }, [connected, mintInput, marketName, selectedTier, tokenMeta, deploy]);

  const handleReset = useCallback(() => {
    reset();
    setWizardStep('token');
    setMintInput('');
    setTokenMeta(null);
    setMetaError(null);
    setSelectedTier('small');
  }, [reset]);

  // Oracle label for review (match web format)
  const oracleLabel = tokenMeta?.pool
    ? `${tokenMeta.pool.pairLabel} (HyperpEMA)`
    : 'Admin Oracle';

  const maxLeverage = 10; // default 1000bps = 10x (match web default)
  const tradingFeeBps = 30; // web default

  /* ── Render: Done (match web LaunchSuccess) ────────────────────── */
  if (wizardStep === 'done') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Market</Text>
        </View>
        <View style={styles.doneContainer}>
          <Text style={styles.doneIcon}>✅</Text>
          <Text style={styles.doneTitle}>{marketName} is live on devnet</Text>
          {deployState.slabAddress && (
            <Text style={styles.doneAddress}>
              Market: {deployState.slabAddress.slice(0, 16)}…
            </Text>
          )}
          {deployState.txSignature && (
            <Text style={styles.doneTx}>
              Tx: {deployState.txSignature.slice(0, 20)}…
            </Text>
          )}
          <Text style={styles.devnetNote}>
            ✓ Devnet mode. Your wallet will receive devnet tokens automatically.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleReset} activeOpacity={0.8}>
            <Text style={styles.primaryBtnText}>DEPLOY ANOTHER →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Render: Deploying (match web LaunchProgress) ──────────────── */
  if (wizardStep === 'deploying') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Market</Text>
        </View>
        {deployState.error ? (
          <View style={styles.content}>
            <ErrorBanner message={deployState.error} />
            <Text style={styles.txStepNote}>
              {TX_STEPS.length} transactions — each requires a wallet signature. Step 1 is atomic: if it fails, no SOL is lost.
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 16 }]}
              onPress={() => setWizardStep('review')}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>← BACK</Text>
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
      </View>

      {/* Step indicator (match web: "Step X of N — Label" + dots) */}
      <View style={styles.stepIndicatorContainer}>
        <StepIndicator current={wizardStep} />
      </View>

      {deployState.error && <ErrorBanner message={deployState.error} />}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Step 1: Token (match web StepTokenSelect) ──────── */}
        {wizardStep === 'token' && (
          <>
            {/* Step sub-header (match web "STEP 1 / 4 — Token") */}
            <View style={styles.stepHeader}>
              <Text style={styles.stepHeaderText}>
                STEP 1 / {STEP_LABELS.length} — TOKEN
              </Text>
            </View>

            <Text style={styles.fieldLabel}>TOKEN MINT ADDRESS</Text>
            <InputField
              label="Token Mint Address"
              value={mintInput}
              onChangeText={handleMintChange}
              placeholder="Paste mint address..."
              autoCapitalize="none"
              autoCorrect={false}
            />

            {metaLoading && (
              <View style={styles.metaRow}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.metaLoading}>Checking mint on network...</Text>
              </View>
            )}

            {metaError && (
              <Text style={styles.metaError}>
                ✗ {metaError}
              </Text>
            )}

            {tokenMeta && !metaLoading && (
              <Panel style={styles.tokenCard}>
                <View style={styles.tokenCardRow}>
                  {/* Token avatar (match web) */}
                  <View style={styles.tokenAvatar}>
                    <Text style={styles.tokenAvatarText}>
                      {tokenMeta.symbol.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.tokenSymbol}>
                      {tokenMeta.symbol}
                      <Text style={styles.tokenNameInline}> {tokenMeta.name}</Text>
                    </Text>
                    <Text style={styles.tokenMintTruncated}>
                      {mintInput.slice(0, 6)}...{mintInput.slice(-4)}
                    </Text>
                  </View>
                </View>
                <View style={styles.tokenMetaRow}>
                  <Text style={styles.tokenMetaLabel}>DECIMALS</Text>
                  <Text style={styles.tokenMetaValue}>{tokenMeta.decimals}</Text>
                </View>
                {tokenMeta.pool ? (
                  <>
                    <View style={styles.tokenMetaRow}>
                      <Text style={styles.tokenMetaLabel}>POOL DETECTED</Text>
                      <Text style={[styles.tokenMetaValue, { color: colors.long }]}>
                        ✓ {tokenMeta.pool.pairLabel}
                      </Text>
                    </View>
                    <View style={styles.tokenMetaRow}>
                      <Text style={styles.tokenMetaLabel}>INITIAL PRICE</Text>
                      <Text style={styles.tokenMetaValue}>
                        ${(Number(tokenMeta.initial_price_e6) / 1_000_000).toFixed(4)}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.tokenMetaRow}>
                    <Text style={styles.tokenMetaLabel}>ORACLE</Text>
                    <Text style={styles.tokenMetaValue}>Admin (devnet default)</Text>
                  </View>
                )}
              </Panel>
            )}

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (!mintInput.trim() || metaLoading) && styles.primaryBtnDisabled,
              ]}
              onPress={() => setWizardStep('slab-tier')}
              disabled={!mintInput.trim() || metaLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>CONTINUE →</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Step 2: Slab Tier (match web quick mode step 2) ── */}
        {wizardStep === 'slab-tier' && (
          <>
            <View style={styles.stepHeader}>
              <Text style={styles.stepHeaderText}>
                STEP 2 / {STEP_LABELS.length} — SLAB TIER
              </Text>
            </View>

            <Text style={styles.sectionDesc}>
              Choose your market size. Larger slabs support more concurrent traders but cost more SOL to deploy.
            </Text>

            <Text style={styles.fieldLabel}>SLAB TIER</Text>

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
              </TouchableOpacity>
            ))}

            {/* Oracle detection status (match web) */}
            {metaLoading ? (
              <Text style={styles.oracleStatus}>⏳ Detecting oracle...</Text>
            ) : tokenMeta?.pool ? (
              <Text style={[styles.oracleStatus, { color: colors.long }]}>
                ✓ DEX pool detected — permissionless on-chain pricing (no keeper needed)
              </Text>
            ) : (
              <Text style={styles.oracleStatus}>
                ℹ Admin oracle — you'll control pricing (devnet token)
              </Text>
            )}

            <View style={styles.navRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setWizardStep('token')}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryBtnText}>← BACK</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, styles.primaryBtnFlex]}
                onPress={() => setWizardStep('review')}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>CONTINUE →</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Step 3: Review (match web StepReview) ──────────── */}
        {wizardStep === 'review' && (
          <>
            <View style={styles.stepHeader}>
              <Text style={styles.stepHeaderText}>
                STEP 3 / {STEP_LABELS.length} — REVIEW
              </Text>
            </View>

            {/* Market Preview (match web) */}
            <Text style={styles.sectionLabel}>MARKET PREVIEW</Text>
            <Panel style={styles.marketPreview}>
              <View style={styles.marketPreviewHeader}>
                <View style={styles.tokenCardRow}>
                  <View style={styles.tokenAvatar}>
                    <Text style={styles.tokenAvatarText}>
                      {(tokenMeta?.symbol ?? '??').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.marketTitle}>{marketName || 'UNKNOWN-PERP'}</Text>
                    <Text style={styles.marketSubtitle}>
                      Oracle: {oracleLabel}
                    </Text>
                    <Text style={styles.marketMint}>
                      Mint: {mintInput.slice(0, 8)}...{mintInput.slice(-6)}
                    </Text>
                  </View>
                </View>
                <View style={styles.badgeRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{tradingFeeBps} bps</Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{maxLeverage}x</Text>
                  </View>
                  <View style={[styles.badge, styles.badgeAccent]}>
                    <Text style={[styles.badgeText, styles.badgeAccentText]}>
                      {TIER_OPTIONS.find((t) => t.key === selectedTier)?.label ?? selectedTier}
                    </Text>
                  </View>
                </View>
              </View>
            </Panel>

            {/* Cost breakdown */}
            <Text style={styles.sectionLabel}>COST ESTIMATE</Text>
            <Panel style={styles.reviewPanel}>
              <ReviewRow
                label="Slab rent"
                value={`${TIER_OPTIONS.find((t) => t.key === selectedTier)?.rentSol ?? '?'} SOL`}
              />
              <ReviewRow label="Network fees" value="~0.025 SOL" />
            </Panel>

            {/* Devnet token notice (match web) */}
            <View style={styles.devnetBanner}>
              <Text style={styles.devnetBannerTitle}>
                ✓ Devnet mode.{' '}
                <Text style={styles.devnetBannerBody}>
                  Your wallet will receive devnet {tokenMeta?.symbol ?? 'tokens'} automatically after the market is created.
                </Text>
              </Text>
              <Text style={styles.devnetBannerSub}>
                No tokens needed upfront — tokens are airdropped post-launch for testing.
              </Text>
            </View>

            {/* Transaction steps (match web) */}
            <Text style={styles.sectionLabel}>TRANSACTION STEPS</Text>
            <Panel style={styles.txStepsPanel}>
              {TX_STEPS.map((step, i) => (
                <View key={i} style={styles.txStepRow}>
                  <Text style={styles.txStepNum}>{i + 1}.</Text>
                  <Text style={styles.txStepLabel}>{step.label}</Text>
                </View>
              ))}
            </Panel>
            <Text style={styles.txStepNote}>
              {TX_STEPS.length} transactions — each requires a wallet signature. Step 1 is atomic: if it fails, no SOL is lost.
            </Text>

            {/* Launch / Connect button (match web labels) */}
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
                  <Text style={styles.primaryBtnText}>CONNECT WALLET TO LAUNCH</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleDeploy}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>LAUNCH & MINT TOKENS →</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.secondaryBtn, { alignSelf: 'center' }]}
              onPress={() => setWizardStep('slab-tier')}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryBtnText}>← BACK</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Styles ──────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgVoid },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },

  /* Step indicator (match web mobile breakpoint) */
  stepIndicatorContainer: { paddingHorizontal: 16, marginBottom: 8 },
  stepIndicatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepIndicatorText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
  },
  stepDots: { flexDirection: 'row', gap: 4 },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  stepDotActive: { backgroundColor: `${colors.accent}99` },
  stepDotDone: { backgroundColor: colors.accent },

  /* Step sub-header (match web "STEP X / 4 — Label") */
  stepHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
    marginBottom: 16,
  },
  stepHeaderText: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '500',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  scroll: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },

  /* Field labels (match web uppercase labels) */
  fieldLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: -8,
  },

  sectionLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '500',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  sectionDesc: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
    marginTop: -8,
  },

  /* Token metadata */
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaLoading: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  metaError: { fontFamily: fonts.body, fontSize: 10, color: colors.short },

  tokenCard: { gap: 8 },
  tokenCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tokenAvatar: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${colors.accent}4D`,
    backgroundColor: `${colors.accent}14`,
  },
  tokenAvatarText: {
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  tokenSymbol: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  tokenNameInline: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  tokenMintTruncated: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
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
    fontSize: 10,
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

  /* Oracle status */
  oracleStatus: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
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

  /* Market preview (match web) */
  marketPreview: { gap: 12 },
  marketPreviewHeader: { gap: 8 },
  marketTitle: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  marketSubtitle: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },
  marketMint: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
  },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badge: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '500',
    color: colors.textMuted,
  },
  badgeAccent: {
    borderColor: `${colors.accent}33`,
    backgroundColor: `${colors.accent}0F`,
  },
  badgeAccentText: {
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
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

  /* Devnet banner (match web) */
  devnetBanner: {
    borderWidth: 1,
    borderColor: `${colors.long}33`,
    backgroundColor: `${colors.long}0A`,
    padding: 12,
    gap: 4,
  },
  devnetBannerTitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.text,
  },
  devnetBannerBody: {
    fontWeight: '400',
  },
  devnetBannerSub: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.textMuted,
  },

  /* Transaction steps (match web) */
  txStepsPanel: { gap: 8 },
  txStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  txStepNum: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  txStepLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
  },
  txStepNote: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: -8,
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
  devnetNote: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.long,
    textAlign: 'center',
    marginTop: 8,
  },

  /* Buttons (match web uppercase style) */
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
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
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
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  navRow: { flexDirection: 'row', gap: 10 },
});
