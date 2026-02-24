import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { Panel } from '../components/ui/Panel';
import { useMWA } from '../hooks/useMWA';
import { useSettingsStore } from '../store/settingsStore';

function SettingsRow({
  label,
  value,
  hasChevron = false,
  onPress,
}: {
  label: string;
  value: string;
  hasChevron?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={hasChevron ? 0.7 : 1}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        <Text style={styles.rowValue}>{value}</Text>
        {hasChevron && <Text style={styles.chevron}>→</Text>}
      </View>
    </TouchableOpacity>
  );
}

const LEVERAGE_OPTIONS = ['1x', '2x', '5x', '10x', '20x'];
const SLIPPAGE_OPTIONS = ['0.1%', '0.5%', '1.0%', '2.0%'];
const EXPLORER_OPTIONS = ['SolanaFM', 'Solscan', 'Solana Explorer'] as const;

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { connected, publicKey, disconnect } = useMWA();
  const settings = useSettingsStore();

  useEffect(() => {
    if (!settings.loaded) settings.load();
  }, [settings.loaded]);

  const showPicker = useCallback(
    (title: string, options: string[], current: string, onSelect: (v: string) => void) => {
      Alert.alert(
        title,
        undefined,
        [
          ...options.map((opt) => ({
            text: opt === current ? `✓ ${opt}` : opt,
            onPress: () => onSelect(opt),
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ],
      );
    },
    [],
  );

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
            {connected && <View style={styles.statusDot} />}
          </View>
          {connected && (
            <Text style={styles.walletBalance}>Balance: — SOL</Text>
          )}
        </Panel>

        {/* Preferences */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <Panel style={styles.section}>
          <SettingsRow
            label="Default Leverage"
            value={settings.defaultLeverage}
            hasChevron
            onPress={() =>
              showPicker('Default Leverage', LEVERAGE_OPTIONS, settings.defaultLeverage, (v) =>
                settings.update({ defaultLeverage: v }),
              )
            }
          />
          <SettingsRow
            label="Slippage Tolerance"
            value={settings.slippageTolerance}
            hasChevron
            onPress={() =>
              showPicker('Slippage Tolerance', SLIPPAGE_OPTIONS, settings.slippageTolerance, (v) =>
                settings.update({ slippageTolerance: v }),
              )
            }
          />
          <SettingsRow
            label="Price Alerts"
            value={settings.priceAlerts ? 'ON' : 'OFF'}
            hasChevron
            onPress={() => settings.update({ priceAlerts: !settings.priceAlerts })}
          />
          <SettingsRow
            label="Haptic Feedback"
            value={settings.hapticFeedback ? 'ON' : 'OFF'}
            onPress={() => settings.update({ hapticFeedback: !settings.hapticFeedback })}
          />
        </Panel>

        {/* Tools */}
        <Text style={styles.sectionLabel}>TOOLS</Text>
        <Panel style={styles.section}>
          <SettingsRow
            label="💧  Faucet"
            value="Get devnet tokens"
            hasChevron
            onPress={() => navigation.navigate('Faucet')}
          />
          <SettingsRow
            label="💰  Deposit / Withdraw"
            value="Manage collateral"
            hasChevron
            onPress={() => navigation.navigate('Collateral')}
          />
          <SettingsRow
            label="🏗  Create Market"
            value="Launch a new market"
            hasChevron
            onPress={() => navigation.navigate('CreateMarket')}
          />
        </Panel>

        {/* Network */}
        <Text style={styles.sectionLabel}>NETWORK</Text>
        <Panel style={styles.section}>
          <SettingsRow label="Network" value={settings.network === 'devnet' ? 'Devnet' : 'Mainnet'} />
          <SettingsRow label="RPC Endpoint" value={settings.rpcEndpoint} />
          <SettingsRow
            label="Explorer"
            value={settings.explorer}
            hasChevron
            onPress={() =>
              showPicker('Explorer', [...EXPLORER_OPTIONS], settings.explorer, (v) =>
                settings.update({ explorer: v as typeof EXPLORER_OPTIONS[number] }),
              )
            }
          />
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
  walletPanel: { gap: 8 },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletIcon: { fontSize: 24 },
  walletInfo: { flex: 1, gap: 2 },
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
  version: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
});
