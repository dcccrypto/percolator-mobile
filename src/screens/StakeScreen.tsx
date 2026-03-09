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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { Panel } from '../components/ui/Panel';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { useMWA } from '../hooks/useMWA';
import { useStake } from '../hooks/useStake';
import { api, type StakePool } from '../lib/api';

/* ── Helpers ─────────────────────────────────────────────────────── */

function formatUsd(value: number | null): string {
  if (value == null) return '$\u2014';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatCooldown(seconds: number): string {
  if (seconds <= 0) return 'None';
  const hours = Math.floor(seconds / 3600);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  return `${Math.floor(seconds / 60)}m`;
}

/* ── Sub-components ──────────────────────────────────────────────── */

const QUICK_AMOUNTS = [10, 50, 100, 500];

const PoolCard = memo(function PoolCard({ pool }: { pool: StakePool }) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<'stake' | 'unstake'>('stake');
  const [amount, setAmount] = useState('');
  const { connected, connect } = useMWA();
  const { submitting: confirming, error: stakeError, deposit, withdraw } = useStake();

  const capPct = pool.capMax > 0 ? Math.min(pool.capUsed / pool.capMax, 1) : 0;
  const capFillColor =
    capPct < 0.5 ? colors.accent :
    capPct < 0.8 ? colors.warning :
    colors.short;

  const handleConfirm = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    if (!connected) {
      connect();
      return;
    }

    const params = { slabAddress: pool.market, amount: parseFloat(amount) };
    const sig = mode === 'stake'
      ? await deposit(params)
      : await withdraw(params);

    if (sig) {
      Alert.alert(
        mode === 'stake' ? 'Staked Successfully' : 'Unstaked Successfully',
        `Transaction: ${sig.slice(0, 20)}...`,
      );
      setAmount('');
      setExpanded(false);
    }
  }, [amount, connected, connect, mode, pool.market, deposit, withdraw]);

  return (
    <Panel style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.poolName}>{pool.name}</Text>
          <Text style={styles.poolMarket}>{pool.market}</Text>
        </View>
        <View style={styles.tvlCol}>
          <Text style={styles.tvlValue}>{formatUsd(pool.tvl)}</Text>
          <Text style={styles.tvlLabel}>TVL</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>APR</Text>
          <Text style={[styles.statValue, pool.apr != null && styles.statValueGreen]}>
            {pool.apr != null ? `${pool.apr.toFixed(1)}%` : '\u2014'}
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Cooldown</Text>
          <Text style={styles.statValue}>{formatCooldown(pool.cooldownSeconds)}</Text>
        </View>
      </View>

      {/* Cap usage bar */}
      <View style={styles.capLabelRow}>
        <Text style={styles.capLabel}>Cap Usage</Text>
        <Text style={styles.capPctText}>{Math.round(capPct * 100)}%</Text>
      </View>
      <View style={styles.capBar}>
        <View
          style={[styles.capFill, { width: `${capPct * 100}%`, backgroundColor: capFillColor }]}
        />
      </View>

      {/* Action buttons */}
      {!expanded && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.stakeBtn}
            activeOpacity={0.7}
            onPress={() => {
              setMode('stake');
              setExpanded(true);
            }}
          >
            <Text style={styles.stakeBtnText}>Stake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.unstakeBtn}
            activeOpacity={0.7}
            onPress={() => {
              setMode('unstake');
              setExpanded(true);
            }}
          >
            <Text style={styles.unstakeBtnText}>Unstake</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Expanded stake / unstake section */}
      {expanded && (
        <View style={styles.expandedSection}>
          {/* Mode toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'stake' && styles.modeBtnActive]}
              onPress={() => setMode('stake')}
              activeOpacity={0.7}
            >
              <Text style={[styles.modeBtnText, mode === 'stake' && styles.modeBtnTextActive]}>
                Stake
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'unstake' && styles.modeBtnActive]}
              onPress={() => setMode('unstake')}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.modeBtnText, mode === 'unstake' && styles.modeBtnTextActive]}
              >
                Unstake
              </Text>
            </TouchableOpacity>
          </View>

          {/* Cooldown warning for unstake */}
          {mode === 'unstake' && pool.cooldownSeconds > 0 && (
            <View style={styles.cooldownWarning}>
              <Text style={styles.cooldownWarningText}>
                Unstaking requires a {formatCooldown(pool.cooldownSeconds)} cooldown period.
              </Text>
            </View>
          )}

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

          {stakeError && <ErrorBanner message={stakeError} />}

          {/* Confirm + Cancel */}
          <View style={styles.confirmRow}>
            <TouchableOpacity
              style={[styles.confirmBtn, mode === 'unstake' && styles.confirmBtnUnstake]}
              onPress={handleConfirm}
              activeOpacity={0.7}
              disabled={confirming}
            >
              {confirming ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Text style={styles.confirmBtnText}>
                  {mode === 'stake' ? 'Confirm Stake' : 'Confirm Unstake'}
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

export function StakeScreen() {
  const [pools, setPools] = useState<StakePool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPools = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getStakePools();
      setPools(data);
    } catch {
      // API may not exist yet — show placeholder state
      setError('unavailable');
      setPools([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPools();
    setRefreshing(false);
  }, [fetchPools]);

  const showPlaceholder = error != null && pools.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Stake</Text>
      </View>

      {/* Info banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>
          Stake your insurance LP tokens to earn additional rewards. Cooldown period applies
          to withdrawals.
        </Text>
      </View>

      {/* Loading state */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : showPlaceholder ? (
        /* Placeholder when API is not available */
        <View style={styles.placeholderContainer}>
          <View style={styles.placeholderIcon}>
            <Text style={styles.placeholderIconText}>S</Text>
          </View>
          <Text style={styles.placeholderTitle}>Staking pools coming soon</Text>
          <Text style={styles.placeholderDesc}>
            Staking pools are under active development. Check back later to stake your LP
            tokens and earn additional yield.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={handleRefresh}
            activeOpacity={0.7}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Pool list */
        <FlatList
          data={pools}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item }) => <PoolCard pool={item} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No staking pools available</Text>
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
  poolName: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  poolMarket: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
  },
  tvlCol: { alignItems: 'flex-end' },
  tvlValue: {
    fontFamily: fonts.mono,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  tvlLabel: {
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
  statValueGreen: {
    color: colors.long,
  },

  /* Cap bar */
  capLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  capLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  capPctText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textSecondary,
  },
  capBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bgOverlay,
    overflow: 'hidden',
  },
  capFill: {
    height: '100%',
    borderRadius: 2,
  },

  /* Action buttons */
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stakeBtn: {
    flex: 1,
    backgroundColor: colors.long,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  stakeBtnText: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  unstakeBtn: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  unstakeBtnText: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
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
  cooldownWarning: {
    backgroundColor: colors.warningSubtle,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: radii.md,
    padding: 10,
  },
  cooldownWarningText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.warning,
    lineHeight: 16,
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
  confirmBtnUnstake: {
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

  /* Placeholder state */
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  placeholderIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  placeholderIconText: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '700',
    color: colors.accent,
  },
  placeholderTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  placeholderDesc: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderActive,
  },
  retryBtnText: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '600',
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
