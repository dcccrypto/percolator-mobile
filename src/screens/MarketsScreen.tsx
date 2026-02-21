import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSizes } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { Panel } from '../components/ui/Panel';

export function MarketsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>MARKETS</Text>

      <Panel style={styles.marketPanel}>
        <View style={styles.marketRow}>
          <Text style={styles.symbol}>SOL/USD</Text>
          <Text style={styles.price}>$—</Text>
          <Text style={[styles.change, { color: colors.textMuted }]}>0.00%</Text>
        </View>
      </Panel>

      <Panel style={styles.infoPanel}>
        <Text style={styles.label}>FUNDING RATE</Text>
        <Text style={styles.emptyText}>Connect wallet to view markets</Text>
      </Panel>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 16,
    gap: 12,
  },
  heading: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 2,
    marginBottom: 4,
  },
  marketPanel: { gap: 8 },
  marketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  symbol: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.base,
    fontWeight: '600',
    color: colors.text,
  },
  price: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.base,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  change: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.sm,
    fontVariant: ['tabular-nums'],
  },
  infoPanel: {
    flex: 1,
    gap: 8,
  },
  label: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  emptyText: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
});
