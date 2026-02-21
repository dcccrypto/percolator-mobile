import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSizes } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { Panel } from '../components/ui/Panel';

export function PortfolioScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>PORTFOLIO</Text>

      <Panel style={styles.balancePanel}>
        <Text style={styles.label}>TOTAL VALUE</Text>
        <Text style={styles.value}>$0.00</Text>
      </Panel>

      <Panel style={styles.pnlPanel}>
        <View style={styles.pnlRow}>
          <View>
            <Text style={styles.label}>UNREALIZED P&L</Text>
            <Text style={[styles.pnlValue, { color: colors.textMuted }]}>$0.00</Text>
          </View>
          <View>
            <Text style={styles.label}>REALIZED P&L</Text>
            <Text style={[styles.pnlValue, { color: colors.textMuted }]}>$0.00</Text>
          </View>
        </View>
      </Panel>

      <Panel style={styles.historyPanel}>
        <Text style={styles.label}>TRADE HISTORY</Text>
        <Text style={styles.emptyText}>No trades yet</Text>
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
  balancePanel: { gap: 4 },
  label: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  value: {
    fontFamily: fonts.mono,
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  pnlPanel: {},
  pnlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pnlValue: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.lg,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  historyPanel: {
    flex: 1,
    gap: 8,
  },
  emptyText: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
});
