import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { Panel } from '../components/ui/Panel';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { useMarkets } from '../hooks/useMarkets';
import { useMWA } from '../hooks/useMWA';
import { useEarn } from '../hooks/useEarn';
import { api, type InsuranceData } from '../lib/api';

/* ── Helpers ─────────────────────────────────────────────────────── */

function formatUsd(value: number | null): string {
  if (value == null) return '$\u2014';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 50%, 40%)`;
}

/* ── Types ───────────────────────────────────────────────────────── */

interface VaultInfo {
  slabAddress: string;
  symbol: string;
  name: string;
  logoUrl: string | null;
  totalOpenInterest: number | null;
  insurance: InsuranceData | null;
  insuranceLoading: boolean;
}

/* ── Sub-components ──────────────────────────────────────────────── */

function MarketLogo({ logoUrl, symbol }: { logoUrl: string | null; symbol: string }) {
  const [failed, setFailed] = useState(false);

  if (logoUrl && !failed) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={styles.marketLogo}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View style={[styles.marketLogoFallback, { backgroundColor: hashColor(symbol) }]}>
      <Text style={styles.marketLogoLetter}>{symbol.charAt(0)}</Text>
    </View>
  );
}

const QUICK_AMOUNTS = [10, 50, 100, 500];

const VaultCard = memo(function VaultCard({ vault }: { vault: VaultInfo }) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const { connected, connect } = useMWA();
  const { submitting: confirming, error: earnError, deposit, withdraw } = useEarn();

  const maxOi = 5_000_000;
  const oiPct = Math.min((vault.totalOpenInterest ?? 0) / maxOi, 1);
  const oiFillColor =
    oiPct < 0.5 ? colors.accent :
    oiPct < 0.8 ? colors.warning :
    colors.short;

  const handleConfirm = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    if (!connected) {
      connect();
      return;
    }

    const params = { slabAddress: vault.slabAddress, amount: parseFloat(amount) };
    const sig = mode === 'deposit'
      ? await deposit(params)
      : await withdraw(params);

    if (sig) {
      Alert.alert(
        mode === 'deposit' ? 'Deposit Successful' : 'Withdrawal Successful',
        `Transaction: ${sig.slice(0, 20)}...`,
      );
      setAmount('');
      setExpanded(false);
    }
  }, [amount, connected, connect, mode, vault.slabAddress, deposit, withdraw]);

  return (
    <Panel style={styles.card}>
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={styles.marketNameRow}>
          <MarketLogo logoUrl={vault.logoUrl} symbol={vault.symbol} />
          <View>
            <Text style={styles.marketName}>{vault.symbol}</Text>
            <Text style={styles.vaultLabel}>Insurance Vault</Text>
          </View>
        </View>
        <View style={styles.balanceCol}>
          {vault.insuranceLoading ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <Text style={styles.balanceValue}>
              {formatUsd(vault.insurance?.currentBalance ?? null)}
            </Text>
          )}
          <Text style={styles.balanceLabel}>Balance</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>APY</Text>
          <Text style={styles.statValue}>{'\u2014'}</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Fee Revenue</Text>
          <Text style={styles.statValue}>
            {vault.insurance ? formatUsd(vault.insurance.feeRevenue) : '\u2014'}
          </Text>
        </View>
      </View>

      {/* OI utilization bar */}
      <View style={styles.oiLabelRow}>
        <Text style={styles.oiLabel}>OI Cap Utilization</Text>
        <Text style={styles.oiPctText}>{Math.round(oiPct * 100)}%</Text>
      </View>
      <View style={styles.oiBar}>
        <View
          style={[styles.oiFill, { width: `${oiPct * 100}%`, backgroundColor: oiFillColor }]}
        />
      </View>

      {/* Deposit button */}
      {!expanded && (
        <TouchableOpacity
          style={styles.depositBtn}
          activeOpacity={0.7}
          onPress={() => setExpanded(true)}
        >
          <Text style={styles.depositBtnText}>Deposit</Text>
        </TouchableOpacity>
      )}

      {/* Expanded deposit / withdraw section */}
      {expanded && (
        <View style={styles.expandedSection}>
          {/* Mode toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'deposit' && styles.modeBtnActive]}
              onPress={() => setMode('deposit')}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.modeBtnText, mode === 'deposit' && styles.modeBtnTextActive]}
              >
                Deposit
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'withdraw' && styles.modeBtnActive]}
              onPress={() => setMode('withdraw')}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.modeBtnText, mode === 'withdraw' && styles.modeBtnTextActive]}
              >
                Withdraw
              </Text>
            </TouchableOpacity>
          </View>

          {/* Amount input */}
          <View style={styles.amountInputRow}>
            <Text style={styles.dollarSign}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              selectionColor={colors.long}
            />
          </View>

          {/* Quick amount buttons */}
          <View style={styles.quickRow}>
            {QUICK_AMOUNTS.map((val) => (
              <TouchableOpacity
                key={val}
                style={styles.quickBtn}
                onPress={() => setAmount(String(val))}
                activeOpacity={0.7}
              >
                <Text style={styles.quickBtnText}>${val}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {earnError && <ErrorBanner message={earnError} />}

          {/* Confirm + Cancel */}
          <View style={styles.confirmRow}>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                mode === 'withdraw' && styles.confirmBtnWithdraw,
              ]}
              onPress={handleConfirm}
              activeOpacity={0.7}
              disabled={confirming}
            >
              {confirming ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Text style={styles.confirmBtnText}>
                  {mode === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdraw'}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setExpanded(false);
                setAmount('');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Panel>
  );
});

/* ── Main Screen ─────────────────────────────────────────────────── */

export function EarnScreen() {
  const { markets, loading: marketsLoading, refetch } = useMarkets();
  const [vaults, setVaults] = useState<VaultInfo[]>([]);
  const [totalTvl, setTotalTvl] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Build vault list from markets + fetch insurance data for each
  useEffect(() => {
    if (markets.length === 0) return;

    const initial: VaultInfo[] = markets.map((m) => ({
      slabAddress: m.slabAddress,
      symbol: m.symbol,
      name: m.name,
      logoUrl: m.logoUrl,
      totalOpenInterest: m.totalOpenInterest,
      insurance: null,
      insuranceLoading: true,
    }));
    setVaults(initial);

    // Fetch insurance data for each market in parallel
    Promise.all(
      markets.map(async (m) => {
        try {
          return await api.getInsurance(m.slabAddress);
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      const updated = initial.map((v, i) => ({
        ...v,
        insurance: results[i],
        insuranceLoading: false,
      }));
      setVaults(updated);

      // Compute total TVL across all vaults
      const tvl = results.reduce((sum, r) => sum + (r?.currentBalance ?? 0), 0);
      setTotalTvl(tvl);
    });
  }, [markets]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Earn</Text>
        <View style={styles.tvlContainer}>
          <Text style={styles.tvlLabel}>Total TVL</Text>
          <Text style={styles.tvlValue}>
            {totalTvl != null ? formatUsd(totalTvl) : '\u2014'}
          </Text>
        </View>
      </View>

      {/* Info banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>
          Deposit into insurance vaults to earn yield from trading fees. Your capital backs
          the insurance fund.
        </Text>
      </View>

      {/* Vault list */}
      {marketsLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={vaults}
          keyExtractor={(item) => item.slabAddress}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item }) => <VaultCard vault={item} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No vaults available</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
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
  tvlContainer: { alignItems: 'flex-end' },
  tvlLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tvlValue: {
    fontFamily: fonts.mono,
    fontSize: 16,
    fontWeight: '700',
    color: colors.long,
    fontVariant: ['tabular-nums'],
  },

  /* Info banner */
  infoBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: colors.bgInset,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoBannerText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  /* List */
  list: { padding: 16, gap: 8 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  /* Card */
  card: { gap: 10, marginBottom: 8 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  marketNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  marketLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  marketLogoFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  marketLogoLetter: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  marketName: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  vaultLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
  },
  balanceCol: { alignItems: 'flex-end' },
  balanceValue: {
    fontFamily: fonts.mono,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  balanceLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  /* Stats row */
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statCell: { gap: 2 },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValue: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  /* OI bar */
  oiLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  oiLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  oiPctText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textSecondary,
  },
  oiBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bgOverlay,
    overflow: 'hidden',
  },
  oiFill: {
    height: '100%',
    borderRadius: 2,
  },

  /* Deposit button */
  depositBtn: {
    backgroundColor: colors.long,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  depositBtnText: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },

  /* Expanded section */
  expandedSection: {
    gap: 10,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.bgInset,
    borderRadius: radii.md,
    padding: 2,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.sm,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: colors.bgElevated,
  },
  modeBtnText: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  modeBtnTextActive: {
    color: colors.text,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInset,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 48,
  },
  dollarSign: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textMuted,
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  quickBtnText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: colors.long,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmBtnWithdraw: {
    backgroundColor: colors.warning,
  },
  confirmBtnText: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },

  /* Empty state */
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
});
