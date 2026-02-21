import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { Panel } from '../components/ui/Panel';
import { InputField } from '../components/ui/InputField';

const TOKENS = [
  { id: 'sol', name: 'SOL', icon: '◆', defaultAmount: '1.0' },
  { id: 'usdc', name: 'USDC', icon: '$', defaultAmount: '1000' },
];

const MOCK_HISTORY = [
  { id: '1', token: 'USDC', amount: '1000', time: '2 min ago', status: '✓' },
  { id: '2', token: 'SOL', amount: '1.0', time: '15 min ago', status: '✓' },
];

export function FaucetScreen() {
  const [selectedToken, setSelectedToken] = useState('usdc');
  const [amount, setAmount] = useState('1000');

  const token = TOKENS.find((t) => t.id === selectedToken)!;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Faucet 🚰</Text>
      </View>

      {/* Balance */}
      <Panel style={styles.balancePanel}>
        <Text style={styles.balanceLabel}>Balance</Text>
        <Text style={styles.balanceValue}>0 ◆</Text>
      </Panel>

      {/* Token Selection */}
      <Text style={styles.sectionLabel}>SELECT TOKEN</Text>
      <View style={styles.tokenRow}>
        {TOKENS.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tokenCard, selectedToken === t.id && styles.tokenCardActive]}
            onPress={() => {
              setSelectedToken(t.id);
              setAmount(t.defaultAmount);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.tokenIcon}>{t.icon}</Text>
            <Text style={styles.tokenName}>{t.name}</Text>
            <Text style={styles.tokenDefault}>{t.defaultAmount}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Amount */}
      <InputField
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        suffix={token.name}
        style={styles.amountInput}
      />

      {/* Info */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoText}>
          ⓘ Devnet tokens have no real value. For testing only.
        </Text>
      </View>

      {/* Mint CTA */}
      <TouchableOpacity style={styles.mintBtn} activeOpacity={0.8}>
        <Text style={styles.mintText}>Mint Tokens 💧</Text>
      </TouchableOpacity>

      {/* History */}
      <Text style={[styles.sectionLabel, { marginTop: 24 }]}>RECENT MINTS</Text>
      <FlatList
        data={MOCK_HISTORY}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.historyRow}>
            <Text style={styles.historyAmount}>
              {item.amount} {item.token}
            </Text>
            <Text style={styles.historyTime}>{item.time}</Text>
            <Text style={styles.historyStatus}>{item.status}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgVoid,
    padding: 16,
  },
  header: {
    paddingBottom: 16,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  balancePanel: {
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  balanceValue: {
    fontFamily: fonts.mono,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  sectionLabel: {
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  tokenRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tokenCard: {
    flex: 1,
    height: 80,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tokenCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSubtle,
  },
  tokenIcon: {
    fontSize: 24,
    color: colors.text,
  },
  tokenName: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  tokenDefault: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
  },
  amountInput: {
    marginBottom: 12,
  },
  infoBanner: {
    backgroundColor: 'rgba(34, 211, 238, 0.06)',
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.cyan,
  },
  mintBtn: {
    backgroundColor: colors.accent,
    height: 52,
    borderRadius: radii.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mintText: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyAmount: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  historyTime: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginRight: 8,
  },
  historyStatus: {
    fontSize: 14,
    color: colors.long,
  },
});
