/**
 * PositionDetailSheet — Full stats for a single position.
 * Shows entry, current, liq, funding paid, size, leverage, PnL, collateral.
 */
import React, { useMemo, forwardRef } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { colors, radii } from '../../theme/tokens';
import { fonts } from '../../theme/fonts';
import type { Position } from '../../hooks/usePositions';

interface Props {
  position: Position | null;
}

function DetailRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

export const PositionDetailSheet = forwardRef<BottomSheet, Props>(
  ({ position }, ref) => {
    const snapPoints = useMemo(() => ['55%'], []);

    if (!position) return null;

    const isLong = position.direction === 'long';
    const pnlPositive = position.pnl >= 0;
    const pnlColor = pnlPositive ? colors.long : colors.short;
    const notional = position.size * position.currentPrice;

    // Liquidation distance as percentage
    const liqDist = isLong
      ? ((position.currentPrice - position.liqPrice) / position.currentPrice) * 100
      : ((position.liqPrice - position.currentPrice) / position.currentPrice) * 100;

    const explorerUrl = `https://solscan.io/account/${position.slabAddress}?cluster=devnet`;

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={s.bg}
        handleIndicatorStyle={s.indicator}
      >
        <BottomSheetView style={s.content}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>{position.symbol}</Text>
            <Text style={[s.dirBadge, { color: isLong ? colors.long : colors.short }]}>
              {position.direction.toUpperCase()} {position.leverage.toFixed(1)}x
            </Text>
          </View>

          {/* PnL highlight */}
          <View style={[s.pnlCard, { borderColor: pnlColor }]}>
            <Text style={s.pnlLabel}>Unrealised PnL</Text>
            <Text style={[s.pnlValue, { color: pnlColor }]}>
              {pnlPositive ? '+' : ''}${position.pnl.toFixed(2)}
            </Text>
            <Text style={[s.pnlPct, { color: pnlColor }]}>
              {pnlPositive ? '+' : ''}{position.pnlPercent.toFixed(2)}%
            </Text>
          </View>

          {/* Detail rows */}
          <View style={s.details}>
            <DetailRow label="Entry Price" value={`$${position.entryPrice.toFixed(2)}`} />
            <DetailRow
              label="Current Price"
              value={`$${position.currentPrice.toFixed(2)}`}
              valueColor={pnlColor}
            />
            <DetailRow label="Position Size" value={position.size.toFixed(4)} />
            <DetailRow label="Notional" value={`$${notional.toFixed(2)}`} />
            <DetailRow label="Collateral" value={`$${position.capital.toFixed(2)}`} />
            <DetailRow label="Leverage" value={`${position.leverage.toFixed(1)}x`} />
            <DetailRow
              label="Liq. Price"
              value={position.liqPrice > 0 ? `$${position.liqPrice.toFixed(2)}` : '—'}
              valueColor={liqDist < 10 ? colors.short : liqDist < 20 ? colors.warning : colors.textMuted}
            />
            <DetailRow
              label="Distance to Liq"
              value={liqDist > 0 ? `${liqDist.toFixed(1)}%` : '—'}
              valueColor={liqDist < 10 ? colors.short : liqDist < 20 ? colors.warning : colors.textSecondary}
            />
          </View>

          {/* Explorer link */}
          <TouchableOpacity
            style={s.explorerBtn}
            onPress={() => Linking.openURL(explorerUrl)}
            activeOpacity={0.7}
          >
            <Text style={s.explorerText}>View on Solscan ↗</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
    );
  },
);

PositionDetailSheet.displayName = 'PositionDetailSheet';

const s = StyleSheet.create({
  bg: {
    backgroundColor: colors.bgElevated,
  },
  indicator: {
    backgroundColor: colors.textMuted,
    width: 40,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  dirBadge: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },
  pnlCard: {
    backgroundColor: colors.bgInset,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  pnlLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  pnlValue: {
    fontFamily: fonts.mono,
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pnlPct: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  details: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  rowLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  rowValue: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  explorerBtn: {
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderActive,
    justifyContent: 'center',
    alignItems: 'center',
  },
  explorerText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
