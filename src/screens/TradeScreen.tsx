import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { Panel } from '../components/ui/Panel';
import { InputField } from '../components/ui/InputField';
import { TradeButton } from '../components/ui/TradeButton';
import { FilterPill } from '../components/ui/FilterPill';
import { useMWA } from '../hooks/useMWA';

const LEVERAGE_OPTIONS = ['1x', '2x', '5x', '10x', '20x'];

export function TradeScreen() {
  const { connected } = useMWA();
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [size, setSize] = useState('');
  const [leverage, setLeverage] = useState('5x');
  const price = 148.32; // mock

  const orderSummary = useMemo(() => {
    const sizeNum = parseFloat(size) || 0;
    const levNum = parseInt(leverage) || 5;
    const margin = sizeNum * price / levNum;
    const liqDistance = price / levNum;
    const liqPrice = direction === 'long' ? price - liqDistance : price + liqDistance;
    const fee = sizeNum * price * 0.001;
    return { entry: price, size: sizeNum, margin, liqPrice, fee };
  }, [size, leverage, direction, price]);

  const isLong = direction === 'long';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>SOL-PERP</Text>
        <Text style={[styles.price, { color: colors.long }]}>
          ${price.toFixed(2)} ↑
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Mini Chart Placeholder */}
        <Panel style={styles.chartPanel}>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartText}>📊 Chart</Text>
          </View>
          <View style={styles.timeframes}>
            {['1m', '5m', '15m', '1h', '4h', '1D'].map((tf) => (
              <TouchableOpacity key={tf} style={styles.tfBtn} activeOpacity={0.7}>
                <Text style={styles.tfText}>{tf}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Panel>

        {/* Direction Toggle */}
        <View style={styles.directionToggle}>
          <TouchableOpacity
            style={[
              styles.directionBtn,
              isLong && { backgroundColor: colors.long },
            ]}
            onPress={() => setDirection('long')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.directionText,
                isLong
                  ? { color: '#ffffff' }
                  : { color: colors.textMuted },
              ]}
            >
              LONG ▲
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.directionBtn,
              !isLong && { backgroundColor: colors.short },
            ]}
            onPress={() => setDirection('short')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.directionText,
                !isLong
                  ? { color: '#ffffff' }
                  : { color: colors.textMuted },
              ]}
            >
              SHORT ▼
            </Text>
          </TouchableOpacity>
        </View>

        {/* Size Input */}
        <InputField
          label="Size (SOL)"
          value={size}
          onChangeText={setSize}
          placeholder="0.00"
          keyboardType="decimal-pad"
          rightAction={{ label: 'MAX', onPress: () => setSize('10.0') }}
        />

        {/* Leverage */}
        <View style={styles.leverageSection}>
          <Text style={styles.label}>Leverage</Text>
          <View style={styles.leveragePills}>
            {LEVERAGE_OPTIONS.map((lev) => (
              <FilterPill
                key={lev}
                label={lev}
                active={leverage === lev}
                onPress={() => setLeverage(lev)}
              />
            ))}
          </View>
        </View>

        {/* Order Summary */}
        <Panel style={styles.summaryPanel}>
          <SummaryRow label="Entry" value={`$${orderSummary.entry.toFixed(2)}`} />
          <SummaryRow label="Size" value={`${orderSummary.size.toFixed(2)} SOL`} />
          <SummaryRow label="Margin" value={`$${orderSummary.margin.toFixed(2)}`} />
          <SummaryRow
            label="Liq. Price"
            value={`$${orderSummary.liqPrice.toFixed(2)}`}
            valueColor={orderSummary.liqPrice > 0 ? colors.warning : colors.textMuted}
          />
          <SummaryRow label="Fee" value={`$${orderSummary.fee.toFixed(2)}`} />
        </Panel>

        {/* CTA */}
        <TradeButton
          label={`OPEN ${direction.toUpperCase()} POSITION`}
          direction={direction}
          fullWidth
          disabled={!connected || orderSummary.size === 0}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={summaryStyles.row}>
      <Text style={summaryStyles.label}>{label}</Text>
      <Text style={[summaryStyles.value, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  value: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgVoid,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  price: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  scroll: { flex: 1 },
  content: {
    padding: 16,
    gap: 16,
  },
  chartPanel: { gap: 8 },
  chartPlaceholder: {
    height: 160,
    backgroundColor: colors.bgInset,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  timeframes: {
    flexDirection: 'row',
    gap: 4,
  },
  tfBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.bgElevated,
  },
  tfText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textSecondary,
  },
  directionToggle: {
    flexDirection: 'row',
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
  },
  directionBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  directionText: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  leverageSection: { gap: 8 },
  label: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  leveragePills: {
    flexDirection: 'row',
  },
  summaryPanel: {
    backgroundColor: colors.bgInset,
    gap: 2,
  },
});
