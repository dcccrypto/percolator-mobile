import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { Panel } from '../components/ui/Panel';
import { InputField } from '../components/ui/InputField';
import { FilterPill } from '../components/ui/FilterPill';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { useMWA } from '../hooks/useMWA';
import { useCollateral } from '../hooks/useCollateral';
import { useMarketStore } from '../store/marketStore';

type Mode = 'deposit' | 'withdraw';

export function CollateralScreen() {
  const { connected } = useMWA();
  const { selectedMarket } = useMarketStore();
  const { submitting, error, deposit, withdraw } = useCollateral();
  const [mode, setMode] = useState<Mode>('deposit');
  const [amount, setAmount] = useState('');

  const slabAddress = selectedMarket?.slabAddress;
  const symbol = selectedMarket?.symbol ?? 'SOL-PERP';

  const amountNum = parseFloat(amount) || 0;
  const canSubmit = connected && !!slabAddress && amountNum > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !slabAddress) return;

    const action = mode === 'deposit' ? 'Deposit' : 'Withdraw';
    Alert.alert(
      `Confirm ${action}`,
      `${action} ${amount} USDC on ${symbol}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action,
          onPress: async () => {
            const fn = mode === 'deposit' ? deposit : withdraw;
            const result = await fn({ slabAddress, amount: amountNum });
            if (result) {
              Alert.alert(
                `✅ ${action} Successful`,
                `Tx: ${result.signature.slice(0, 16)}…`,
                [{ text: 'OK' }],
              );
              setAmount('');
            }
          },
        },
      ],
    );
  }, [canSubmit, slabAddress, mode, amount, symbol, amountNum, deposit, withdraw]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Deposit / Withdraw</Text>
      </View>

      {error && <ErrorBanner message={error} />}

      {/* Mode Toggle */}
      <View style={styles.modeToggle}>
        <FilterPill
          label="Deposit ↓"
          active={mode === 'deposit'}
          onPress={() => setMode('deposit')}
        />
        <FilterPill
          label="Withdraw ↑"
          active={mode === 'withdraw'}
          onPress={() => setMode('withdraw')}
        />
      </View>

      {/* Market indicator */}
      <Panel style={styles.marketPanel}>
        <Text style={styles.marketLabel}>MARKET</Text>
        <Text style={styles.marketValue}>
          {slabAddress ? symbol : 'Select a market from Markets tab'}
        </Text>
      </Panel>

      {/* Amount input */}
      <View style={styles.inputSection}>
        <InputField
          label={`${mode === 'deposit' ? 'Deposit' : 'Withdraw'} Amount`}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
          suffix="USDC"
        />
      </View>

      {/* Quick amount buttons */}
      <View style={styles.quickAmounts}>
        {['10', '50', '100', '500', '1000'].map((v) => (
          <TouchableOpacity
            key={v}
            style={styles.quickBtn}
            onPress={() => setAmount(v)}
            activeOpacity={0.7}
          >
            <Text style={styles.quickText}>${v}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Info */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoText}>
          {mode === 'deposit'
            ? 'ⓘ Collateral is deposited into the market vault. You need collateral to open positions.'
            : 'ⓘ Withdraw available collateral. Cannot withdraw below maintenance margin.'}
        </Text>
      </View>

      {/* Wallet not connected hint */}
      {!connected && (
        <Text style={styles.hint}>Connect your wallet first.</Text>
      )}

      {/* Submit CTA */}
      <TouchableOpacity
        style={[
          styles.submitBtn,
          mode === 'withdraw' && styles.submitBtnWithdraw,
          !canSubmit && styles.submitBtnDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.submitText}>
            {mode === 'deposit' ? 'Deposit Collateral ↓' : 'Withdraw Collateral ↑'}
          </Text>
        )}
      </TouchableOpacity>
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
  modeToggle: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  marketPanel: {
    marginBottom: 16,
  },
  marketLabel: {
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 2,
  },
  marketValue: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
    marginTop: 4,
  },
  inputSection: {
    marginBottom: 12,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickBtn: {
    flex: 1,
    height: 36,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textSecondary,
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
  hint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: colors.long,
    height: 52,
    borderRadius: radii.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnWithdraw: {
    backgroundColor: colors.accent,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitText: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
