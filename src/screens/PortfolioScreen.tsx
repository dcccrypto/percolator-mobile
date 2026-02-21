import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { FilterPill } from '../components/ui/FilterPill';

interface Position {
  id: string;
  market: string;
  direction: 'long' | 'short';
  leverage: number;
  entryPrice: number;
  currentPrice: number;
  size: number;
  liqPrice: number;
}

const MOCK_POSITIONS: Position[] = [
  {
    id: '1',
    market: 'SOL-PERP',
    direction: 'long',
    leverage: 5,
    entryPrice: 141.2,
    currentPrice: 148.32,
    size: 5,
    liqPrice: 113.0,
  },
  {
    id: '2',
    market: 'ETH-PERP',
    direction: 'short',
    leverage: 10,
    entryPrice: 2890.0,
    currentPrice: 2847.1,
    size: 1,
    liqPrice: 3179.0,
  },
];

function PositionCard({ position }: { position: Position }) {
  const isLong = position.direction === 'long';
  const pnlRaw = isLong
    ? (position.currentPrice - position.entryPrice) * position.size
    : (position.entryPrice - position.currentPrice) * position.size;
  const pnlPct = isLong
    ? ((position.currentPrice - position.entryPrice) / position.entryPrice) * 100
    : ((position.entryPrice - position.currentPrice) / position.entryPrice) * 100;
  const pnlPositive = pnlRaw >= 0;
  const pnlColor = pnlPositive ? colors.long : colors.short;

  // Liquidation proximity warning
  const liqDistance = isLong
    ? (position.currentPrice - position.liqPrice) / position.currentPrice
    : (position.liqPrice - position.currentPrice) / position.currentPrice;
  const liqWarning = liqDistance < 0.2;
  const liqCritical = liqDistance < 0.1;

  return (
    <View style={[styles.posCard, { borderLeftColor: isLong ? colors.long : colors.short }]}>
      {/* Header */}
      <View style={styles.posHeader}>
        <Text style={styles.posMarket}>{position.market}</Text>
        <View style={styles.posDirection}>
          <Text style={[styles.posDirText, { color: isLong ? colors.long : colors.short }]}>
            {position.direction.toUpperCase()} {position.leverage}x
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
          <Text style={styles.posStatLabel}>Current</Text>
          <Text style={[styles.posStatValue, { color: pnlColor }]}>
            ${position.currentPrice.toFixed(2)}
          </Text>
        </View>
        <View style={styles.posStatCol}>
          <Text style={styles.posStatLabel}>PnL</Text>
          <Text style={[styles.posPnl, { color: pnlColor }]}>
            {pnlPositive ? '+' : ''}${pnlRaw.toFixed(2)} ({pnlPositive ? '+' : ''}{pnlPct.toFixed(1)}%)
          </Text>
        </View>
      </View>

      {/* Liq price */}
      <View style={styles.posLiqRow}>
        <Text style={styles.posStatLabel}>Liq:</Text>
        <Text
          style={[
            styles.posLiqValue,
            { color: liqCritical ? colors.short : liqWarning ? colors.warning : colors.textMuted },
          ]}
        >
          ${position.liqPrice.toFixed(2)}
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.posActions}>
        <TouchableOpacity style={styles.posActionBtn} activeOpacity={0.7}>
          <Text style={styles.posActionText}>Manage</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.posActionBtn, styles.posCloseBtn]}
          activeOpacity={0.7}
        >
          <Text style={styles.posCloseText}>Close ✕</Text>
        </TouchableOpacity>
      </View>

      {/* Liquidation warning */}
      {liqWarning && (
        <View style={[styles.liqWarning, liqCritical && styles.liqCritical]}>
          <Text style={styles.liqWarningText}>
            ⚠ Liquidation at ${position.liqPrice.toFixed(2)}
            {liqCritical ? ' — CRITICAL' : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

export function PortfolioScreen() {
  const [tab, setTab] = useState<'open' | 'history' | 'orders'>('open');

  const totalPnl = MOCK_POSITIONS.reduce((sum, p) => {
    const isLong = p.direction === 'long';
    const pnl = isLong
      ? (p.currentPrice - p.entryPrice) * p.size
      : (p.entryPrice - p.currentPrice) * p.size;
    return sum + pnl;
  }, 0);
  const totalPnlPct = 12.3; // mock
  const pnlPositive = totalPnl >= 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with total PnL */}
      <View style={styles.header}>
        <Text style={styles.title}>Portfolio</Text>
        <View style={styles.pnlHeader}>
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
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <FilterPill
          label={`Open (${MOCK_POSITIONS.length})`}
          active={tab === 'open'}
          onPress={() => setTab('open')}
        />
        <FilterPill label="History" active={tab === 'history'} onPress={() => setTab('history')} />
        <FilterPill label="Orders" active={tab === 'orders'} onPress={() => setTab('orders')} />
      </View>

      {/* Position List */}
      <FlatList
        data={tab === 'open' ? MOCK_POSITIONS : []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <PositionCard position={item} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No {tab} positions</Text>
        }
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
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  list: {
    padding: 16,
    gap: 8,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
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
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  posLiqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  posLiqValue: {
    fontFamily: fonts.mono,
    fontSize: 12,
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
    borderColor: 'rgba(239, 68, 68, 0.3)',
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
