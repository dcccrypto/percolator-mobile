import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Polyline } from 'react-native-svg';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { Panel } from '../components/ui/Panel';
import { api, type TraderStats, type TraderTrade } from '../lib/api';
import { useMWA } from '../hooks/useMWA';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateWallet(wallet: string): string {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function formatUsd(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatPnl(pnl: number): string {
  const prefix = pnl >= 0 ? '+' : '';
  return `${prefix}${formatUsd(pnl)}`;
}

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

// ---------------------------------------------------------------------------
// PnL Mini Chart (SVG line from trade history)
// ---------------------------------------------------------------------------

const CHART_WIDTH = 280;
const CHART_HEIGHT = 60;

function PnlChart({ trades }: { trades: TraderTrade[] }) {
  const points = useMemo(() => {
    if (trades.length < 2) return null;

    // Build cumulative PnL series from oldest to newest
    const sorted = [...trades].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    const cumPnl: number[] = [];
    let running = 0;
    for (const t of sorted) {
      running += t.pnl;
      cumPnl.push(running);
    }

    const minVal = Math.min(...cumPnl);
    const maxVal = Math.max(...cumPnl);
    const range = maxVal - minVal || 1;
    const padding = 4;

    const pts = cumPnl.map((val, i) => {
      const x = (i / (cumPnl.length - 1)) * (CHART_WIDTH - padding * 2) + padding;
      const y = CHART_HEIGHT - padding - ((val - minVal) / range) * (CHART_HEIGHT - padding * 2);
      return `${x},${y}`;
    });

    return { pointsStr: pts.join(' '), isPositive: running >= 0 };
  }, [trades]);

  if (!points) {
    return (
      <View style={styles.chartPlaceholder}>
        <Text style={styles.chartPlaceholderText}>Not enough data for chart</Text>
      </View>
    );
  }

  return (
    <View style={styles.chartWrap}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Polyline
          points={points.pointsStr}
          fill="none"
          stroke={points.isPositive ? colors.long : colors.short}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <Panel style={styles.gridCard}>
      <Text style={styles.gridLabel}>{label}</Text>
      <Text style={[styles.gridValue, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
    </Panel>
  );
}

function TradeRow({ trade }: { trade: TraderTrade }) {
  const isLong = trade.side === 'long';
  const pnlPositive = trade.pnl >= 0;

  const handlePress = () => {
    if (trade.signature) {
      Linking.openURL(`https://solscan.io/tx/${trade.signature}`);
    }
  };

  return (
    <TouchableOpacity
      style={styles.tradeRow}
      activeOpacity={trade.signature ? 0.7 : 1}
      onPress={handlePress}
      disabled={!trade.signature}
    >
      <View style={styles.tradeLeft}>
        <Text style={styles.tradeMarket}>{trade.market}</Text>
        <Text style={[styles.tradeSide, { color: isLong ? colors.long : colors.short }]}>
          {isLong ? 'Long' : 'Short'}
        </Text>
      </View>

      <View style={styles.tradeCenter}>
        <Text style={styles.tradeSize}>{formatUsd(trade.size)}</Text>
        <Text style={styles.tradePrice}>${trade.entryPrice.toFixed(2)}</Text>
      </View>

      <View style={styles.tradeRight}>
        <Text style={[styles.tradePnl, { color: pnlPositive ? colors.long : colors.short }]}>
          {formatPnl(trade.pnl)}
        </Text>
        <Text style={styles.tradeTime}>{formatTime(trade.timestamp)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function EmptyNotConnected() {
  let navigation: any = null;
  try { navigation = useNavigation(); } catch { /* test env */ }
  return (
    <View style={styles.emptyContainer}>
      {/* Devnet hero */}
      <View style={styles.devnetHero}>
        <Text style={styles.devnetBadge}>🟢 DEVNET LIVE</Text>
        <Text style={styles.devnetHeroTitle}>Permissionless Perpetual Futures</Text>
        <Text style={styles.devnetHeroSub}>Trade any token with up to 100× leverage — no permission needed.</Text>
      </View>

      {/* Quick-start steps */}
      <View style={styles.quickStart}>
        <Text style={styles.quickStartTitle}>GET STARTED</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={() => navigation?.navigate('Faucet' as never)} activeOpacity={0.7}>
          <Text style={styles.stepNum}>1</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepLabel}>Get Devnet SOL</Text>
            <Text style={styles.stepDesc}>Free SOL for testing trades</Text>
          </View>
          <Text style={styles.stepArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.stepBtn} onPress={() => navigation?.navigate('Markets' as never)} activeOpacity={0.7}>
          <Text style={styles.stepNum}>2</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepLabel}>Browse Markets</Text>
            <Text style={styles.stepDesc}>SOL, BTC, ETH and more</Text>
          </View>
          <Text style={styles.stepArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.stepBtn} onPress={() => navigation?.navigate('More' as never, { screen: 'CreateMarket' } as never)} activeOpacity={0.7}>
          <Text style={styles.stepNum}>3</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepLabel}>Create Your Own Market</Text>
            <Text style={styles.stepDesc}>Launch a market for any token</Text>
          </View>
          <Text style={styles.stepArrow}>→</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.emptyIconWrap}>
        <Text style={styles.emptyIcon}>{'\u{1F512}'}</Text>
      </View>
      <Text style={styles.emptyTitle}>Connect wallet to start trading</Text>
      <Text style={styles.emptySubtitle}>
        Your trading performance, stats, and trade history will appear here once connected.
      </Text>
    </View>
  );
}

function EmptyTrades() {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Text style={styles.emptyIcon}>{'\u{1F4CA}'}</Text>
      </View>
      <Text style={styles.emptyTitle}>No trades yet</Text>
      <Text style={styles.emptySubtitle}>
        Your trade history will appear here after you make your first trade.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function DashboardScreen() {
  const { connected, publicKey } = useMWA();
  const walletAddress = connected && publicKey ? publicKey.toBase58() : null;

  const [stats, setStats] = useState<TraderStats | null>(null);
  const [trades, setTrades] = useState<TraderTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!walletAddress) return;
    try {
      setLoading(true);
      setError(null);
      const [statsData, tradesData] = await Promise.all([
        api.getTraderStats(walletAddress),
        api.getTraderTrades(walletAddress),
      ]);
      setStats(statsData);
      setTrades(tradesData.trades);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (walletAddress) {
      fetchDashboard();
    } else {
      setStats(null);
      setTrades([]);
    }
  }, [walletAddress, fetchDashboard]);

  const handleCopyAddress = () => {
    if (!walletAddress) return;
    Alert.alert('Wallet Address', walletAddress);
  };

  // Not connected
  if (!connected || !walletAddress) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard</Text>
        </View>
        <EmptyNotConnected />
      </SafeAreaView>
    );
  }

  const pnlPositive = (stats?.totalPnl ?? 0) >= 0;
  const pnlColor = pnlPositive ? colors.long : colors.short;
  const winRateColor =
    (stats?.winRate ?? 0) >= 60
      ? colors.long
      : (stats?.winRate ?? 0) >= 40
        ? colors.text
        : colors.short;

  const headerContent = (
    <>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <TouchableOpacity onPress={handleCopyAddress} activeOpacity={0.7}>
          <Text style={styles.walletAddress}>{truncateWallet(walletAddress)}</Text>
        </TouchableOpacity>
      </View>

      {/* Error */}
      {error != null && (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Loading */}
      {loading && !stats && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      )}

      {/* PnL Summary Card */}
      {stats != null && (
        <View style={styles.sectionWrap}>
          <Panel style={styles.pnlCard}>
            <Text style={styles.pnlLabel}>Total PnL</Text>
            <Text style={[styles.pnlValue, { color: pnlColor }]}>
              {formatPnl(stats.totalPnl)}
            </Text>
            {stats.totalVolume > 0 && (
              <Text style={[styles.pnlPercent, { color: pnlColor }]}>
                {pnlPositive ? '+' : ''}
                {((stats.totalPnl / stats.totalVolume) * 100).toFixed(2)}%
              </Text>
            )}
            <PnlChart trades={trades} />
          </Panel>
        </View>
      )}

      {/* Stats Grid */}
      {stats != null && (
        <View style={styles.sectionWrap}>
          <View style={styles.statsGrid}>
            <View style={styles.statsGridRow}>
              <StatCard label="Total Trades" value={stats.totalTrades.toLocaleString()} />
              <StatCard
                label="Win Rate"
                value={`${stats.winRate.toFixed(1)}%`}
                valueColor={winRateColor}
              />
            </View>
            <View style={styles.statsGridRow}>
              <StatCard label="Total Volume" value={formatUsd(stats.totalVolume)} />
              <StatCard label="Avg Leverage" value={`${stats.avgLeverage.toFixed(1)}x`} />
            </View>
          </View>
        </View>
      )}

      {/* Trade History Header */}
      {stats != null && (
        <View style={styles.tradeHistoryHeader}>
          <Text style={styles.sectionTitle}>Trade History</Text>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={stats != null ? trades : []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={headerContent}
        refreshControl={
          <RefreshControl
            refreshing={loading && stats != null}
            onRefresh={fetchDashboard}
            tintColor={colors.accent}
          />
        }
        renderItem={({ item }) => <TradeRow trade={item} />}
        ListEmptyComponent={stats != null ? <EmptyTrades /> : null}
      />
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
  walletAddress: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.accent,
  },
  sectionWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  // PnL Card
  pnlCard: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 20,
  },
  pnlLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pnlValue: {
    fontFamily: fonts.mono,
    fontSize: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pnlPercent: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    marginBottom: 8,
  },
  // Chart
  chartWrap: {
    alignItems: 'center',
    marginTop: 8,
  },
  chartPlaceholder: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  chartPlaceholderText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  // Stats Grid
  statsGrid: {
    gap: 8,
  },
  statsGridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gridCard: {
    flex: 1,
    gap: 4,
  },
  gridLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  gridValue: {
    fontFamily: fonts.mono,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  // Trade History
  tradeHistoryHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tradeLeft: {
    flex: 1,
    gap: 2,
  },
  tradeMarket: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  tradeSide: {
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  tradeCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  tradeSize: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  tradePrice: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  tradeRight: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  tradePnl: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  tradeTime: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
  },
  // List
  list: {
    paddingBottom: 32,
  },
  // Loading / Error / Empty
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
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
  // Quick-start / devnet hero
  devnetHero: {
    width: '100%',
    backgroundColor: 'rgba(20, 241, 149, 0.06)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(20, 241, 149, 0.15)',
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  devnetBadge: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: colors.cyan,
    letterSpacing: 2,
    marginBottom: 8,
  },
  devnetHeroTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  devnetHeroSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  quickStart: {
    width: '100%',
    marginBottom: 24,
    gap: 8,
  },
  quickStartTitle: {
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: 4,
  },
  stepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  stepNum: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '700',
    color: colors.accent,
    width: 28,
    textAlign: 'center',
  },
  stepContent: {
    flex: 1,
    gap: 2,
  },
  stepLabel: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  stepDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  stepArrow: {
    fontFamily: fonts.mono,
    fontSize: 18,
    color: colors.textMuted,
  },
});
