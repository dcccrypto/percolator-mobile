import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { Panel } from '../components/ui/Panel';
import { useMWA } from '../hooks/useMWA';

function SettingsRow({
  label,
  value,
  hasChevron = false,
}: {
  label: string;
  value: string;
  hasChevron?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.row} activeOpacity={hasChevron ? 0.7 : 1}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        <Text style={styles.rowValue}>{value}</Text>
        {hasChevron && <Text style={styles.chevron}>→</Text>}
      </View>
    </TouchableOpacity>
  );
}

export function SettingsScreen() {
  const { connected, publicKey, disconnect } = useMWA();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Wallet */}
        <Text style={styles.sectionLabel}>WALLET</Text>
        <Panel style={styles.walletPanel}>
          <View style={styles.walletRow}>
            <Text style={styles.walletIcon}>🔐</Text>
            <View style={styles.walletInfo}>
              <Text style={styles.walletAddress}>
                {connected
                  ? `${publicKey?.toBase58().slice(0, 6)}...${publicKey?.toBase58().slice(-4)}`
                  : 'Not connected'}
              </Text>
              <Text style={styles.walletStatus}>
                {connected ? 'Seed Vault · Connected' : 'Disconnected'}
              </Text>
            </View>
            {connected && (
              <View style={styles.statusDot} />
            )}
          </View>
          {connected && (
            <Text style={styles.walletBalance}>Balance: — SOL</Text>
          )}
        </Panel>

        {/* Preferences */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <Panel style={styles.section}>
          <SettingsRow label="Default Leverage" value="5x" hasChevron />
          <SettingsRow label="Slippage Tolerance" value="0.5%" hasChevron />
          <SettingsRow label="Price Alerts" value="ON" hasChevron />
          <SettingsRow label="Haptic Feedback" value="ON" />
        </Panel>

        {/* Network */}
        <Text style={styles.sectionLabel}>NETWORK</Text>
        <Panel style={styles.section}>
          <SettingsRow label="Network" value="Devnet" hasChevron />
          <SettingsRow label="RPC Endpoint" value="Default" hasChevron />
          <SettingsRow label="Explorer" value="SolanaFM" hasChevron />
        </Panel>

        {/* Disconnect */}
        {connected && (
          <TouchableOpacity
            style={styles.disconnectBtn}
            onPress={disconnect}
            activeOpacity={0.7}
          >
            <Text style={styles.disconnectText}>Disconnect Wallet</Text>
          </TouchableOpacity>
        )}

        {/* Version */}
        <Text style={styles.version}>v1.0.0-devnet</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgVoid,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    padding: 16,
    gap: 8,
  },
  sectionLabel: {
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 4,
  },
  section: {
    gap: 0,
    padding: 0,
    overflow: 'hidden',
  },
  // Wallet
  walletPanel: {
    gap: 8,
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletIcon: {
    fontSize: 24,
  },
  walletInfo: {
    flex: 1,
    gap: 2,
  },
  walletAddress: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
  },
  walletStatus: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.long,
  },
  walletBalance: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 36,
  },
  // Settings rows
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chevron: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textMuted,
  },
  // Disconnect
  disconnectBtn: {
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: radii.lg,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  disconnectText: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '600',
    color: colors.short,
  },
  // Version
  version: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
});
