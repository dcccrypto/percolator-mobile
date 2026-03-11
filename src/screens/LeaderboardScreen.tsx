import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { FilterPill } from '../components/ui/FilterPill';
import { Panel } from '../components/ui/Panel';
import { api, type LeaderboardEntry } from '../lib/api';
import { useMWA } from '../hooks/useMWA';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Period = '24h' | '7d' | '30d' | 'all';

const PERIODS: { label: string; value: Period }[] = [
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: 'All Time', value: 'all' },
];

function truncateWallet(wallet: string): string {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) return `$${(volume / 1_000_000_000).toFixed(1)}B`;
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(1)}K`;
  return `$${volume.toFixed(0)}`;
}

function formatPnl(pnl: number): string {
  const prefix = pnl >= 0 ? '+' : '';
  if (Math.abs(pnl) >= 1_000_000) return `${prefix}$${(pnl / 1_000_000).toFixed(1)}M`;
  if (Math.abs(pnl) >= 1_000) return `${prefix}$${(pnl / 1_000).toFixed(1)}K`;
  return `${prefix}$${pnl.toFixed(2)}`;
}

const MEDAL_COLORS: Record<number, string> = {
  1: '#FFD700',
  2: '#C0C0C0',
  3: '#CD7F32',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RankRow({ entry, isCurrentUser }: { entry: LeaderboardEntry; isCurrentUser: boolean }) {
  const isTop3 = entry.rank <= 3;
  const pnlPositive = entry.pnl >= 0;
  const borderColor = MEDAL_COLORS[entry.rank] ?? colors.border;

  return (
    <View
      style={[
        styles.rankRow,
        isTop3 && { borderLeftWidth: 3, borderLeftColor: borderColor },
        isCurrentUser && styles.rankRowCurrentUser,
      ]}
    >
      <View style={styles.rankNumCol}>
        <Text style={[styles.rankNum, isTop3 && styles.rankNumTop3]}>
          #{entry.rank}
        </Text>
      </View>

      <View style={styles.rankWalletCol}>
        <Text
          style={[
            styles.rankWallet,
            isTop3 && styles.rankWalletTop3,
            isCurrentUser && { color: colors.accent },
          ]}
          numberOfLines={1}
        >
          {truncateWallet(entry.wallet)}
        </Text>
      </View>

      <View style={styles.rankStatCol}>
        <Text style={styles.rankStatValue}>{entry.tradeCount}</Text>
      </View>

      <View style={styles.rankStatCol}>
        <Text style={styles.rankStatValue}>{formatVolume(entry.volume)}</Text>
      </View>

      <View style={styles.rankPnlCol}>
        <Text
          style={[
            styles.rankPnlValue,
            { color: pnlPositive ? colors.long : colors.short },
          ]}
        >
          {formatPnl(entry.pnl)}
        </Text>
      </View>
    </View>
  );
}

function StatsBanner({ traders, totalVolume }: { traders: number; totalVolume: number }) {
  return (
    <Panel style={styles.statsBanner}>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Traders</Text>
          <Text style={styles.statValue}>{traders.toLocaleString()}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total Volume</Text>
          <Text style={styles.statValue}>{formatVolume(totalVolume)}</Text>
        </View>
      </View>
    </Panel>
  );
}

function ColumnHeader() {
  return (
    <View style={styles.columnHeader}>
      <View style={styles.rankNumCol}>
        <Text style={styles.colHeaderText}>Rank</Text>
      </View>
      <View style={styles.rankWalletCol}>
        <Text style={styles.colHeaderText}>Wallet</Text>
      </View>
      <View style={styles.rankStatCol}>
        <Text style={styles.colHeaderText}>Trades</Text>
      </View>
      <View style={styles.rankStatCol}>
        <Text style={styles.colHeaderText}>Volume</Text>
      </View>
      <View style={styles.rankPnlCol}>
        <Text style={[styles.colHeaderText, { textAlign: 'right' }]}>PnL</Text>
      </View>
    </View>
  );
}

function EmptyLeaderboard() {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Text style={styles.emptyIcon}>{'\u{1F3C6}'}</Text>
      </View>
      <Text style={styles.emptyTitle}>No rankings yet</Text>
      <Text style={styles.emptySubtitle}>
        Leaderboard data will appear once traders start competing.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function LeaderboardScreen() {
  const [period, setPeriod] = useState<Period>('24h');
  const [traders, setTraders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { publicKey, connected } = useMWA();

  const walletAddress = connected && publicKey ? publicKey.toBase58() : null;

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getLeaderboard(period);
      setTraders(data.leaderboard ?? data.traders ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load leaderboard';
      setError(msg.includes('429') ? 'Too many requests — pull to refresh' : msg);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const totalVolume = traders.reduce((sum, t) => sum + t.volume, 0);

  const currentUserEntry = walletAddress
    ? traders.find((t) => t.wallet === walletAddress)
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.trophy}>{'\u{1F3C6}'}</Text>
          <Text style={styles.title}>Leaderboard</Text>
        </View>
      </View>

      {/* Period filter pills */}
      <View style={styles.filters}>
        {PERIODS.map((p) => (
          <FilterPill
            key={p.value}
            label={p.label}
            active={period === p.value}
            onPress={() => setPeriod(p.value)}
          />
        ))}
      </View>

      {/* Stats banner */}
      {!loading && traders.length > 0 && (
        <View style={styles.bannerWrap}>
          <StatsBanner traders={traders.length} totalVolume={totalVolume} />
        </View>
      )}

      {/* Error */}
      {error != null && (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Loading */}
      {loading && traders.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading rankings...</Text>
        </View>
      ) : (
        <>
          {traders.length > 0 && <ColumnHeader />}

          <FlatList
            data={traders}
            keyExtractor={(item) => `${item.rank}-${item.wallet}`}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={loading && traders.length > 0}
                onRefresh={fetchLeaderboard}
                tintColor={colors.accent}
              />
            }
            renderItem={({ item }) => (
              <RankRow
                entry={item}
                isCurrentUser={walletAddress === item.wallet}
              />
            )}
            ListEmptyComponent={<EmptyLeaderboard />}
          />
        </>
      )}

      {/* Sticky footer — your rank */}
      {currentUserEntry != null && (
        <View style={styles.yourRankFooter}>
          <View style={styles.yourRankInner}>
            <Text style={styles.yourRankLabel}>Your Rank</Text>
            <View style={styles.yourRankRow}>
              <Text style={styles.yourRankNum}>#{currentUserEntry.rank}</Text>
              <Text style={styles.yourRankDivider}>/</Text>
              <Text style={styles.yourRankTotal}>{traders.length}</Text>
              <View style={{ flex: 1 }} />
              <Text
                style={[
                  styles.yourRankPnl,
                  { color: currentUserEntry.pnl >= 0 ? colors.long : colors.short },
                ]}
              >
                {formatPnl(currentUserEntry.pnl)}
              </Text>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgVoid,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trophy: {
    fontSize: 22,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  bannerWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  statsBanner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statValue: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  columnHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  colHeaderText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rankRowCurrentUser: {
    backgroundColor: colors.accentSubtle,
  },
  rankNumCol: {
    width: 44,
  },
  rankNum: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  rankNumTop3: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  rankWalletCol: {
    flex: 1,
    paddingRight: 8,
  },
  rankWallet: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.textSecondary,
  },
  rankWalletTop3: {
    color: colors.text,
    fontWeight: '600',
  },
  rankStatCol: {
    width: 56,
    alignItems: 'flex-end',
    paddingRight: 8,
  },
  rankStatValue: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  rankPnlCol: {
    width: 72,
    alignItems: 'flex-end',
  },
  rankPnlValue: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  list: {
    paddingBottom: 80,
  },
  yourRankFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
  },
  yourRankInner: {
    gap: 4,
  },
  yourRankLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  yourRankRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  yourRankNum: {
    fontFamily: fonts.mono,
    fontSize: 24,
    fontWeight: '700',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  yourRankDivider: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.textMuted,
    marginHorizontal: 4,
  },
  yourRankTotal: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  yourRankPnl: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorWrap: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.shortSubtle,
    borderRadius: radii.md,
    padding: 12,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.short,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
