import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { usePositionStore } from '../store/positionStore';
import { FilterPill } from '../components/ui/FilterPill';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { PartialCloseSheet } from '../components/trade/PartialCloseSheet';
import { PositionDetailSheet } from '../components/trade/PositionDetailSheet';
import { useMWA } from '../hooks/useMWA';
import { WalletErrorSheet } from '../components/wallet/WalletErrorSheet';
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

function EmptyConnectWallet({ onConnect }: { onConnect: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Text style={styles.emptyIcon}>🔐</Text>
      </View>
      <Text style={styles.emptyTitle}>Connect your wallet</Text>
      <Text style={styles.emptySubtitle}>
        Connect a Solana wallet to view positions and start trading.
      </Text>
      <TouchableOpacity
        style={styles.emptyActionBtn}
        onPress={onConnect}
        activeOpacity={0.8}
        testID="portfolio-connect-wallet"
      >
        <Text style={styles.emptyActionText}>Connect Wallet</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyPortfolio({ onTrade }: { onTrade: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Text style={styles.emptyIcon}>📂</Text>
      </View>
      <Text style={styles.emptyTitle}>No open positions</Text>
      <Text style={styles.emptySubtitle}>
        Open a trade to see your positions here.
      </Text>
      <TouchableOpacity
        style={styles.emptyActionBtn}
        onPress={onTrade}
        activeOpacity={0.8}
        testID="portfolio-start-trading"
      >
        <Text style={styles.emptyActionText}>Start Trading →</Text>
      </TouchableOpacity>
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
      <Text style={styles.emptyTitle}>Limit & Stop orders coming soon</Text>
      <Text style={styles.emptySubtitle}>
        Market orders are available now via the vAMM. Limit and stop orders are on the roadmap.
      </Text>
    </View>
  );
}

export function PortfolioScreen() {
  const [tab, setTab] = useState<'open' | 'history' | 'orders'>('open');
  const { connected, publicKey, connect, error: mwaError, errorKind, clearError } = useMWA();
  const navigation = useNavigation<any>();
  const walletErrorRef = useRef<BottomSheet>(null);

  // Show wallet error sheet instead of raw Alert (#77)
  useEffect(() => {
    if (errorKind) {
      walletErrorRef.current?.snapToIndex(0);
    }
  }, [errorKind]);
  const { submitTrade, submitting } = useTrade();
  const setOpenPositionCount = usePositionStore((s) => s.setOpenPositionCount);

  // Bottom sheet refs
  const detailSheetRef = useRef<BottomSheet>(null);
  const closeSheetRef = useRef<BottomSheet>(null);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

  const { positions, loading, error, refresh } = usePositions(
    connected && publicKey ? publicKey.toBase58() : null,
  );

  /** Open the position detail sheet. */
  const handleManage = useCallback(
    (position: Position) => {
      setSelectedPosition(position);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      detailSheetRef.current?.snapToIndex(0);
    },
    [],
  );

  /** Open partial close sheet. */
  const handleOpenPartialClose = useCallback(
    (position: Position) => {
      setSelectedPosition(position);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      closeSheetRef.current?.snapToIndex(0);
    },
    [],
  );

  /** Execute partial close. */
  const handlePartialClose = useCallback(
    async (position: Position, sizeToClose: number) => {
      try {
        const userIdx = parseInt(position.id.split(':')[1], 10);
        const pricePerUnit = position.currentPrice || position.entryPrice;
        const sizeUsd = sizeToClose * pricePerUnit;
        await submitTrade({
          slabAddress: position.slabAddress,
          userIdx,
          sizeUsd,
          direction: position.direction === 'long' ? 'short' : 'long',
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('✅ Position Closed', `Closed ${sizeToClose.toFixed(4)} of ${position.symbol}.`);
        closeSheetRef.current?.close();
        refresh();
      } catch (err) {
        Alert.alert('Failed to close', err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [submitTrade, refresh],
  );

  /** Open partial close sheet for the position (supports full and partial close). */
  const handleClose = useCallback(
    (position: Position) => {
      handleOpenPartialClose(position);
    },
    [handleOpenPartialClose],
  );

  // Summary stats
  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const totalCapital = positions.reduce((sum, p) => sum + p.capital, 0);
  const totalPnlPct = totalCapital > 0 ? (totalPnl / totalCapital) * 100 : 0;
  const pnlPositive = totalPnl >= 0;

  const openPositions = positions.filter((p) => p.size !== 0);
  // History = closed positions (size is 0 but had trades)
  const closedPositions = positions.filter((p) => p.size === 0);

  // Sync open position count to global store for tab badge
  useEffect(() => {
    setOpenPositionCount(openPositions.length);
  }, [openPositions.length, setOpenPositionCount]);
  // Orders: pending/limit orders — placeholder until backend supports
  const pendingOrders: Position[] = [];

  // Select data based on active tab
  const tabData =
    tab === 'open'
      ? openPositions
      : tab === 'history'
        ? closedPositions
        : pendingOrders;

  const renderEmptyComponent = useCallback(() => {
    if (loading) return null;
    if (!connected) {
      return <EmptyConnectWallet onConnect={connect} />;
    }
    if (tab === 'open') {
      return <EmptyPortfolio onTrade={() => navigation.navigate('Trade')} />;
    }
    if (tab === 'history') return <EmptyHistory />;
    return <EmptyOrders />;
  }, [loading, connected, connect, tab, navigation]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
        ListEmptyComponent={renderEmptyComponent}
      />

      {/* Position Detail Sheet */}
      <PositionDetailSheet ref={detailSheetRef} position={selectedPosition} />

      {/* Partial Close Sheet */}
      <PartialCloseSheet
        ref={closeSheetRef}
        position={selectedPosition}
        submitting={submitting}
        onClose={handlePartialClose}
      />
    </SafeAreaView>
    {errorKind && (
      <WalletErrorSheet
        ref={walletErrorRef}
        kind={errorKind}
        onDismiss={() => {
          walletErrorRef.current?.close();
          clearError();
        }}
      />
    )}
    </GestureHandlerRootView>
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
  emptyActionBtn: {
    marginTop: 20,
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radii.xl,
  },
  emptyActionText: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
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
