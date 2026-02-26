import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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
import { useCreateMarket } from '../hooks/useCreateMarket';

export function MarketCreationScreen() {
  const { connected, connect, connecting } = useMWA();
  const { state: deployState, deploy, reset } = useCreateMarket();

  const [mode, setMode] = useState<'quick' | 'manual'>('quick');
  const [name, setName] = useState('');
  const [oracle, setOracle] = useState('');
  const [maxLeverage, setMaxLeverage] = useState('20');
  const [fundingRate, setFundingRate] = useState('0.01');
  const [insurance, setInsurance] = useState('1000');
  const [makerFee, setMakerFee] = useState('0.02');
  const [takerFee, setTakerFee] = useState('0.05');

  const canDeploy =
    connected &&
    name.trim().length >= 3 &&
    !deployState.deploying;

  const handleDeploy = useCallback(() => {
    if (!canDeploy) return;

    deploy({
      name,
      oracle,
      maxLeverage: parseInt(maxLeverage, 10) || 20,
      fundingRate: parseFloat(fundingRate) || 0.01,
      insurance: parseInt(insurance, 10) || 1000,
      makerFee: parseFloat(makerFee) || 0.02,
      takerFee: parseFloat(takerFee) || 0.05,
      mode,
    });
  }, [
    canDeploy,
    deploy,
    name,
    oracle,
    maxLeverage,
    fundingRate,
    insurance,
    makerFee,
    takerFee,
    mode,
  ]);

  const handleConnectOrDeploy = useCallback(() => {
    if (!connected) {
      connect();
      return;
    }
    handleDeploy();
  }, [connected, connect, handleDeploy]);

  // Estimate cost based on mode
  const estimatedCost = mode === 'quick' ? '~0.3 SOL' : '~0.5 SOL';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Create Market</Text>
      </View>

      {/* Mode Toggle */}
      <View style={styles.modeToggle}>
        <FilterPill
          label="Quick Launch ⚡"
          active={mode === 'quick'}
          onPress={() => setMode('quick')}
        />
        <FilterPill
          label="Manual ⚙"
          active={mode === 'manual'}
          onPress={() => setMode('manual')}
        />
      </View>

      {deployState.error && (
        <ErrorBanner message={deployState.error} />
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <InputField
          label="Market Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. DOGE-PERP"
        />

        <InputField
          label="Oracle / Price Feed"
          value={oracle}
          onChangeText={setOracle}
          placeholder="Pyth feed ID (optional — admin oracle if empty)"
        />

        {mode === 'manual' && (
          <Panel style={styles.paramsPanel}>
            <Text style={styles.paramsTitle}>PARAMETERS</Text>
            <InputField
              label="Max Leverage"
              value={maxLeverage}
              onChangeText={setMaxLeverage}
              suffix="x"
              keyboardType="numeric"
            />
            <InputField
              label="Funding Rate"
              value={fundingRate}
              onChangeText={setFundingRate}
              suffix="%"
              keyboardType="decimal-pad"
            />
            <InputField
              label="Insurance Fund"
              value={insurance}
              onChangeText={setInsurance}
              suffix="◆"
              keyboardType="numeric"
            />
            <InputField
              label="Maker Fee"
              value={makerFee}
              onChangeText={setMakerFee}
              suffix="%"
              keyboardType="decimal-pad"
            />
            <InputField
              label="Taker Fee"
              value={takerFee}
              onChangeText={setTakerFee}
              suffix="%"
              keyboardType="decimal-pad"
            />
          </Panel>
        )}

        {/* Cost breakdown */}
        <View style={styles.costPanel}>
          <Text style={styles.costPanelTitle}>Cost Breakdown</Text>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Network fees</Text>
            <Text style={styles.costValue}>{estimatedCost}</Text>
          </View>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Seed deposit</Text>
            <Text style={styles.costValue}>Token-denominated</Text>
          </View>
          <Text style={styles.costNote}>
            Seed liquidity is paid in your market's base token, not SOL or USDC.
            Exact amount shown at confirmation.
          </Text>
        </View>

        {/* Deploy step indicator */}
        {deployState.deploying && (
          <View style={styles.stepRow}>
            <ActivityIndicator color={colors.accent} size="small" />
            <Text style={styles.stepText}>{deployState.step}</Text>
          </View>
        )}

        {/* Success state */}
        {deployState.txSignature && !deployState.deploying && (
          <Panel style={styles.successPanel}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successText}>Market deployed!</Text>
            <Text style={styles.txText}>
              Tx: {deployState.txSignature.slice(0, 20)}…
            </Text>
            <TouchableOpacity
              style={styles.newMarketBtn}
              onPress={() => {
                reset();
                setName('');
                setOracle('');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.newMarketText}>Create Another</Text>
            </TouchableOpacity>
          </Panel>
        )}

        {/* Deploy CTA */}
        {!deployState.txSignature && (
          <TouchableOpacity
            style={[
              styles.deployBtn,
              (!canDeploy && connected) && styles.deployBtnDisabled,
            ]}
            activeOpacity={0.8}
            onPress={handleConnectOrDeploy}
            disabled={deployState.deploying}
          >
            {connecting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.deployText}>
                {!connected
                  ? 'Connect Wallet 🔗'
                  : deployState.deploying
                    ? 'Deploying…'
                    : 'Deploy Market 🚀'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {!connected && (
          <Text style={styles.hint}>
            Connect your Solana wallet to deploy a market on devnet.
          </Text>
        )}
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
  modeToggle: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  scroll: { flex: 1 },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  paramsPanel: {
    gap: 12,
  },
  paramsTitle: {
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 2,
  },
  costPanel: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  costPanelTitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  costLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  costValue: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  costNote: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 8,
    lineHeight: 16,
  },
  deployBtn: {
    backgroundColor: colors.accent,
    height: 52,
    borderRadius: radii.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deployBtnDisabled: {
    opacity: 0.4,
  },
  deployText: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stepText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  successPanel: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  successIcon: {
    fontSize: 32,
  },
  successText: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.long,
  },
  txText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
  },
  newMarketBtn: {
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.md,
    marginTop: 8,
  },
  newMarketText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.accent,
    fontWeight: '600',
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
