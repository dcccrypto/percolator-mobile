import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { Panel } from '../components/ui/Panel';
import { InputField } from '../components/ui/InputField';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { connection } from '../lib/solana';
import { useMWA } from '../hooks/useMWA';

const TOKENS = [
  { id: 'sol', name: 'SOL', icon: '◆', defaultAmount: '1.0' },
  { id: 'usdc', name: 'USDC', icon: '$', defaultAmount: '1000' },
];

interface MintRecord {
  id: string;
  token: string;
  amount: string;
  time: string;
  status: '✓' | '⏳' | '✗';
}

export function FaucetScreen() {
  const { connected, publicKey } = useMWA();
  const [selectedToken, setSelectedToken] = useState('sol');
  const [amount, setAmount] = useState('1.0');
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<MintRecord[]>([]);

  const token = TOKENS.find((t) => t.id === selectedToken)!;

  const handleMint = useCallback(async () => {
    if (!connected || !publicKey) {
      setError('Connect your wallet first');
      return;
    }

    setMinting(true);
    setError(null);

    const record: MintRecord = {
      id: Date.now().toString(),
      token: token.name,
      amount,
      time: 'Just now',
      status: '⏳',
    };
    setHistory((prev) => [record, ...prev]);

    try {
      if (selectedToken === 'sol') {
        // Request SOL airdrop on devnet
        const lamports = Math.round(parseFloat(amount) * LAMPORTS_PER_SOL);
        if (lamports <= 0 || lamports > 2 * LAMPORTS_PER_SOL) {
          throw new Error('SOL airdrop limited to 0-2 SOL per request');
        }

        const sig = await connection.requestAirdrop(publicKey, lamports);
        await connection.confirmTransaction(sig, 'confirmed');

        setHistory((prev) =>
          prev.map((r) => (r.id === record.id ? { ...r, status: '✓' as const } : r)),
        );

        Alert.alert('✅ SOL Airdrop', `${amount} SOL sent!\nTx: ${sig.slice(0, 16)}…`);
      } else {
        // USDC on devnet — there's no universal devnet USDC faucet, so we show a helpful message.
        // In production, this would call a backend faucet endpoint.
        throw new Error(
          'Devnet USDC mint requires a faucet backend. Use the API endpoint at /api/faucet or airdrop SOL first.',
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Mint failed';
      setError(msg);
      setHistory((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, status: '✗' as const } : r)),
      );
    } finally {
      setMinting(false);
    }
  }, [connected, publicKey, selectedToken, amount, token.name]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Faucet 🚰</Text>
      </View>

      {error && <ErrorBanner message={error} />}

      {/* Balance */}
      <Panel style={styles.balancePanel}>
        <Text style={styles.balanceLabel}>Balance</Text>
        <Text style={styles.balanceValue}>
          {connected ? '—' : 'Connect wallet'}
        </Text>
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
          {selectedToken === 'sol' ? ' Max 2 SOL per airdrop.' : ''}
        </Text>
      </View>

      {/* Mint CTA */}
      <TouchableOpacity
        style={[styles.mintBtn, (!connected || minting) && styles.mintBtnDisabled]}
        activeOpacity={0.8}
        onPress={handleMint}
        disabled={!connected || minting}
      >
        {minting ? (
          <ActivityIndicator color={colors.text} size="small" />
        ) : (
          <Text style={styles.mintText}>
            {selectedToken === 'sol' ? 'Airdrop SOL 💧' : 'Mint Tokens 💧'}
          </Text>
        )}
      </TouchableOpacity>

      {!connected && (
        <Text style={styles.hint}>Connect your wallet to use the faucet.</Text>
      )}

      {/* History */}
      <Text style={[styles.sectionLabel, { marginTop: 24 }]}>RECENT MINTS</Text>
      {history.length === 0 ? (
        <Text style={styles.emptyText}>No mints yet</Text>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.historyRow}>
              <Text style={styles.historyAmount}>
                {item.amount} {item.token}
              </Text>
              <Text style={styles.historyTime}>{item.time}</Text>
              <Text style={[styles.historyStatus, item.status === '✗' && { color: colors.short }]}>
                {item.status}
              </Text>
            </View>
          )}
        />
      )}
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
    backgroundColor: colors.cyanMuted,
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
  mintBtnDisabled: {
    opacity: 0.4,
  },
  mintText: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 16,
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
