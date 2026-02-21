import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSizes } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { Panel } from '../components/ui/Panel';
import { useMWA } from '../hooks/useMWA';

export function SettingsScreen() {
  const { connected, publicKey, disconnect } = useMWA();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>SETTINGS</Text>

      <Panel style={styles.section}>
        <Text style={styles.label}>WALLET</Text>
        {connected ? (
          <View style={styles.walletInfo}>
            <Text style={styles.address}>{publicKey?.toBase58()}</Text>
            <TouchableOpacity onPress={disconnect} style={styles.disconnectBtn} activeOpacity={0.7}>
              <Text style={styles.disconnectText}>DISCONNECT</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.emptyText}>Not connected</Text>
        )}
      </Panel>

      <Panel style={styles.section}>
        <Text style={styles.label}>NETWORK</Text>
        <Text style={styles.value}>Mainnet Beta</Text>
      </Panel>

      <Panel style={styles.section}>
        <Text style={styles.label}>VERSION</Text>
        <Text style={styles.value}>1.0.0</Text>
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
  section: { gap: 8 },
  label: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  value: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  walletInfo: { gap: 8 },
  address: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.xs,
    color: colors.accent,
    lineHeight: 18,
  },
  disconnectBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,59,92,0.3)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  disconnectText: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.short,
    letterSpacing: 1,
  },
  emptyText: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
});
