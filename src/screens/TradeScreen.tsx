import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSizes } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { Panel } from '../components/ui/Panel';
import { HudCorners } from '../components/ui/HudCorners';
import { useMWA } from '../hooks/useMWA';

export function TradeScreen() {
  const { connected, publicKey, connect, connecting } = useMWA();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>PERCOLATOR</Text>
        <View style={styles.statusDot} />
      </View>

      {/* Wallet */}
      {!connected ? (
        <HudCorners>
          <TouchableOpacity
            style={styles.connectBtn}
            onPress={connect}
            disabled={connecting}
            activeOpacity={0.7}
          >
            <Text style={styles.connectText}>
              {connecting ? 'CONNECTING...' : 'CONNECT WALLET'}
            </Text>
          </TouchableOpacity>
        </HudCorners>
      ) : (
        <Panel style={styles.walletPanel}>
          <Text style={styles.walletLabel}>WALLET</Text>
          <Text style={styles.walletAddress}>
            {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
          </Text>
        </Panel>
      )}

      {/* Trading placeholder */}
      <Panel style={styles.tradePanel}>
        <Text style={styles.sectionLabel}>TRADE</Text>
        <View style={styles.tradeButtons}>
          <TouchableOpacity style={[styles.tradeBtn, styles.longBtn]} activeOpacity={0.7}>
            <Text style={styles.longText}>LONG</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tradeBtn, styles.shortBtn]} activeOpacity={0.7}>
            <Text style={styles.shortText}>SHORT</Text>
          </TouchableOpacity>
        </View>
      </Panel>

      {/* Positions placeholder */}
      <Panel style={styles.positionsPanel}>
        <Text style={styles.sectionLabel}>POSITIONS</Text>
        <Text style={styles.emptyText}>No open positions</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  connectBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(153,69,255,0.3)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  connectText: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 1.5,
  },
  walletPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletLabel: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  walletAddress: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.sm,
    color: colors.accent,
  },
  tradePanel: {
    flex: 1,
    gap: 12,
  },
  sectionLabel: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  tradeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  tradeBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  longBtn: {
    borderColor: 'rgba(20,241,149,0.3)',
    backgroundColor: 'rgba(20,241,149,0.06)',
  },
  shortBtn: {
    borderColor: 'rgba(255,59,92,0.3)',
    backgroundColor: 'rgba(255,59,92,0.06)',
  },
  longText: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.long,
    letterSpacing: 2,
  },
  shortText: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.short,
    letterSpacing: 2,
  },
  positionsPanel: {
    flex: 1,
    gap: 8,
  },
  emptyText: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
});
