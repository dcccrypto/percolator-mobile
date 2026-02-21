import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { Panel } from '../components/ui/Panel';
import { InputField } from '../components/ui/InputField';
import { FilterPill } from '../components/ui/FilterPill';

export function MarketCreationScreen() {
  const [mode, setMode] = useState<'quick' | 'manual'>('quick');
  const [name, setName] = useState('');
  const [oracle, setOracle] = useState('');
  const [maxLeverage, setMaxLeverage] = useState('20');
  const [fundingRate, setFundingRate] = useState('0.01');
  const [insurance, setInsurance] = useState('1000');
  const [makerFee, setMakerFee] = useState('0.02');
  const [takerFee, setTakerFee] = useState('0.05');

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
          placeholder="Select Pyth feed..."
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

        {/* Cost estimate */}
        <View style={styles.costRow}>
          <Text style={styles.costLabel}>Estimated Cost:</Text>
          <Text style={styles.costValue}>~0.5 SOL</Text>
        </View>

        {/* Deploy CTA */}
        <TouchableOpacity style={styles.deployBtn} activeOpacity={0.8}>
          <Text style={styles.deployText}>Deploy Market 🚀</Text>
        </TouchableOpacity>
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
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  costValue: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  deployBtn: {
    backgroundColor: colors.accent,
    height: 52,
    borderRadius: radii.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deployText: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
