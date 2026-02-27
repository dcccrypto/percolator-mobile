import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { FilterPill } from '../components/ui/FilterPill';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { useMWA } from '../hooks/useMWA';
import { usePositions, type Position } from '../hooks/usePositions';
import { useTrade } from '../hooks/useTrade';

function PositionCard({
  position,
  onClose,
  onManage,
}: {
  position: Position;
  onClose: (position: Position) => void;
  onManage: (position: Position) => void;
}) {
  const isLong = position.direction === 'long';
  const pnlPositive = position.pnl >= 0;
  const pnlColor = pnlPositive ? colors.long : colors.short;

  // Liquidation proximity
  const liqDistance = isLong
    ? (position.currentPrice - position.liqPrice) / position.currentPrice
    : (position.liqPrice - position.currentPrice) / position.currentPrice;
  const liqWarning = liqDistance > 0 && liqDistance < 0.2;
  const liqCritical = liqDistance > 0 && liqDistance < 0.1;

  const sizeLabel = position.size < 1
    ? position.size.toFixed(4)
    : position.size.toFixed(2);

  return (
    <View style={[styles.posCard, { borderLeftColor: isLong ? colors.long : colors.short }]}>
      {/* Header */}
      <View style={styles.posHeader}>
        <Text style={styles.posMarket}>{position.symbol}</Text>
        <View style={styles.posDirection}>
          <Text style={[styles.posDirText, { color: isLong ? colors.long : colors.short }]}>
            {position.direction.toUpperCase()} {position.leverage.toFixed(1)}x
          </Text>
        </View>
      </View>

      {/* Stats grid */}
      <View style={styles.posGrid}>
        <View style={styles.posStatCol}>
          <Text style={styles.posStatLabel}>Entry</Text>
          <Text style={styles.posStatValue}>${position.entryPrice.toFixed(2)}</Text>
        </View>
        <View style={styles.posStatCol}>
          <Text style={styles.posStatLabel}>Mark</Text>
          <Text style={[styles.posStatValue, { color: pnlColor }]}>
            ${position.currentPrice.toFixed(2)}
          </Text>
        </View>
        <View style={styles.posStatCol}>
          <Text style={styles.posStatLabel}>PnL</Text>
          <Text style={[styles.posPnl, { color: pnlColor }]}>
            {pnlPositive ? '+' : ''}${position.pnl.toFixed(2)}
            {'\n'}
            {pnlPositive ? '+' : ''}{position.pnlPercent.toFixed(1)}%
          </Text>
        </View>
      </View>

      {/* Size + Liq row */}
      <View style={styles.posBottomRow}>
        <View style={styles.posStatCol}>
          <Text style={styles.posStatLabel}>Size</Text>
          <Text style={styles.posStatValue}>{sizeLabel}</Text>
        </View>
        <View style={styles.posStatCol}>
          <Text style={styles.posStatLabel}>Collateral</Text>
          <Text style={styles.posStatValue}>${position.capital.toFixed(2)}</Text>
        </View>
        <View style={styles.posStatCol}>
          <Text style={styles.posStatLabel}>Liq. Price</Text>
          <Text
            style={[
              styles.posLiqValue,
              {
                color: liqCritical
                  ? colors.short
                  : liqWarning
                  ? colors.warning
                  : colors.textMuted,
              },
            ]}
          >
            {position.liqPrice > 0 ? `$${position.liqPrice.toFixed(2)}` : '—'}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.posActions}>
        <TouchableOpacity
          style={styles.posActionBtn}
          activeOpacity={0.7}
          onPress={() => onManage(position)}
        >
          <Text style={styles.posActionText}>Manage</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.posActionBtn, styles.posCloseBtn]}
          activeOpacity={0.7}
          onPress={() => onClose(position)}
        >
          <Text style={styles.posCloseText}>Close ✕</Text>
        </TouchableOpacity>
      </View>

      {/* Liquidation warning */}
      {liqWarning && (
        <View style={[styles.liqWarning, liqCritical && styles.liqCritical]}>
          <Text style={[styles.liqWarningText, liqCritical && { color: colors.short }]}>
            ⚠ {liqCritical ? 'CRITICAL — ' : ''}Liquidation at $
            {position.liqPrice.toFixed(2)}
          </Text>
        </View>
      )}
    </View>
  );
}

function EmptyPortfolio() {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Text style={styles.emptyIcon}>📂</Text>
      </View>
      <Text style={styles.emptyTitle}>No open positions</Text>
      <Text style={styles.emptySubtitle}>
        Open a trade to see your positions here.
      </Text>
    </View>
  );
}

function EmptyHistory() {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Text style={styles.emptyIcon}>🕐</Text>
      </View>
      <Text style={styles.emptyTitle}>No trade history</Text>
      <Text style={styles.emptySubtitle}>
        Your closed positions and past trades will appear here.
      </Text>
    </View>
  );
}

function EmptyOrders() {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Text style={styles.emptyIcon}>📋</Text>
      </View>
      <Text style={styles.emptyTitle}>No open orders</Text>
      <Text style={styles.emptySubtitle}>
        Limit and stop orders you place will appear here.
      </Text>
    </View>
  );
}

export function PortfolioScreen() {
  const [tab, setTab] = useState<'open' | 'history' | 'orders'>('open');
  const { connected, publicKey } = useMWA();
  const navigation = useNavigation<any>();
  const { submitTrade, submitting } = useTrade();

  const { positions, loading, error, refresh } = usePositions(
    connected && publicKey ? publicKey.toBase58() : null,
  );

  /** Navigate to the Trade tab with the position's market selected for adjustment. */
  const handleManage = useCallback(
    (position: Position) => {
      navigation.navigate('Trade', {
        direction: position.direction,
      });
    },
    [navigation],
  );

  /** Show confirmation dialog and close the position by submitting a counter-trade. */
  const handleClose = useCallback(
    (position: Position) => {
      const sizeUsd = position.capital * position.leverage;
      Alert.alert(
        'Close Position',
        `Close your ${position.direction.toUpperCase()} ${position.symbol} position?\n\nSize: ${position.size.toFixed(4)}\nPnL: ${position.pnl >= 0 ? '+' : ''}$${position.pnl.toFixed(2)}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Close Position',
            style: 'destructive',
            onPress: async () => {
              try {
                // position.id is `${slabAddress}:${accountId}`
                const userIdx = parseInt(position.id.split(':')[1], 10);
                await submitTrade({
                  slabAddress: position.slabAddress,
                  userIdx,
                  sizeUsd,
                  direction: position.direction === 'long' ? 'short' : 'long',
                });
                Alert.alert('✅ Position Closed', `${position.symbol} position closed.`);
                refresh();
              } catch (err) {
                Alert.alert(
                  'Failed to close',
                  err instanceof Error ? err.message : 'Unknown error',
                );
              }
            },
          },
        ],
      );
    },
    [submitTrade, refresh],
  );

  // Summary stats
  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const totalCapital = positions.reduce((sum, p) => sum + p.capital, 0);
  const totalPnlPct = totalCapital > 0 ? (totalPnl / totalCapital) * 100 : 0;
  const pnlPositive = totalPnl >= 0;

  const openPositions = positions.filter((p) => p.size !== 0);
  // History = closed positions (size is 0 but had trades)
  const closedPositions = positions.filter((p) => p.size === 0);
  // Orders: pending/limit orders — placeholder until backend supports
  const pendingOrders: Position[] = [];

  // Select data based on active tab
  const tabData =
    tab === 'open'
      ? openPositions
      : tab === 'history'
        ? closedPositions
        : pendingOrders;

  const TabEmptyComponent =
    tab === 'open'
      ? EmptyPortfolio
      : tab === 'history'
        ? EmptyHistory
        : EmptyOrders;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with total PnL */}
      <View style={styles.header}>
        <Text style={styles.title}>Portfolio</Text>
        {connected ? (
          <View style={styles.pnlHeader}>
            {loading && positions.length === 0 ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <>
                <Text
                  style={[
                    styles.totalPnl,
                    { color: pnlPositive ? colors.long : colors.short },
                  ]}
                >
                  {pnlPositive ? '+' : ''}${totalPnl.toFixed(2)}
                </Text>
                <Text
                  style={[
                    styles.totalPnlPct,
                    { color: pnlPositive ? colors.long : colors.short },
                  ]}
                >
                  {pnlPositive ? '+' : ''}{totalPnlPct.toFixed(1)}%
                </Text>
              </>
            )}
          </View>
        ) : (
          <Text style={styles.notConnected}>Connect wallet</Text>
        )}
      </View>

      {error && (
        <ErrorBanner
          message={error}
          onRetry={refresh}
        />
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        <FilterPill
          label={`Open (${openPositions.length})`}
          active={tab === 'open'}
          onPress={() => setTab('open')}
        />
        <FilterPill
          label="History"
          active={tab === 'history'}
          onPress={() => setTab('history')}
        />
        <FilterPill
          label="Orders"
          active={tab === 'orders'}
          onPress={() => setTab('orders')}
        />
      </View>

      {/* Position list */}
      <FlatList
        data={tabData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading && positions.length > 0}
            onRefresh={refresh}
            tintColor={colors.accent}
          />
        }
        renderItem={({ item }) => (
          <PositionCard
            position={item}
            onClose={handleClose}
            onManage={handleManage}
          />
        )}
        ListEmptyComponent={!loading ? <TabEmptyComponent /> : null}
      />
    </SafeAreaView>
  );
}

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
  pnlHeader: {
    alignItems: 'flex-end',
  },
  totalPnl: {
    fontFamily: fonts.mono,
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  totalPnlPct: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  notConnected: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  list: {
    padding: 16,
    paddingBottom: 32,
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
  // Position Card
  posCard: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderRadius: radii.lg,
    padding: 16,
    gap: 10,
    marginBottom: 8,
  },
  posHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  posMarket: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  posDirection: {},
  posDirText: {
    fontFamily: fonts.display,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  posGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  posBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  posStatCol: { gap: 2 },
  posStatLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
  },
  posStatValue: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  posPnl: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  posLiqValue: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  posActions: {
    flexDirection: 'row',
    gap: 8,
  },
  posActionBtn: {
    flex: 1,
    height: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderActive,
    justifyContent: 'center',
    alignItems: 'center',
  },
  posActionText: {
    fontFamily: fonts.display,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  posCloseBtn: {
    borderColor: colors.shortBorder,
  },
  posCloseText: {
    fontFamily: fonts.display,
    fontSize: 12,
    fontWeight: '600',
    color: colors.short,
  },
  liqWarning: {
    backgroundColor: colors.warningSubtle,
    borderLeftWidth: 2,
    borderLeftColor: colors.warning,
    borderRadius: radii.sm,
    padding: 8,
  },
  liqCritical: {
    backgroundColor: colors.shortSubtle,
    borderLeftColor: colors.short,
  },
  liqWarningText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.warning,
  },
});
