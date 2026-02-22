import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { Panel } from '../components/ui/Panel';
import { InputField } from '../components/ui/InputField';
import { TradeButton } from '../components/ui/TradeButton';
import { FilterPill } from '../components/ui/FilterPill';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { useMWA } from '../hooks/useMWA';
import { usePriceStream as usePriceStreamMulti } from '../hooks/usePriceStream';
import { useTrade } from '../hooks/useTrade';
import { useMarketStore } from '../store/marketStore';

const LEVERAGE_OPTIONS = ['1x', '2x', '5x', '10x', '20x'];

export function TradeScreen() {
  const { connected, publicKey } = useMWA();
  const { selectedMarket, userIdx } = useMarketStore();
  const slabAddress = selectedMarket?.slabAddress;
  const symbol = selectedMarket?.symbol ?? 'SOL-PERP';
  const { prices } = usePriceStreamMulti(slabAddress ? [slabAddress] : []);
  const livePrice = slabAddress ? prices[slabAddress]?.price ?? null : null;
  const { submitting, error: tradeError, submitTrade } = useTrade();

  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [size, setSize] = useState('');
  const [leverage, setLeverage] = useState('5x');

  // Use live streamed price, fall back to 0 while loading
  const price = livePrice ?? 0;
  const priceReady = price > 0;

  const orderSummary = useMemo(() => {
    const sizeNum = parseFloat(size) || 0;
    const levNum = parseInt(leverage) || 5;
    // sizeUsd = position notional in USD
    const sizeUsd = sizeNum * price;
    const margin = sizeUsd / levNum;
    // Simplified liq estimate: entry ± entry/leverage
    const liqDistance = price / levNum;
    const liqPrice =
      direction === 'long' ? price - liqDistance : price + liqDistance;
    const fee = sizeUsd * 0.001; // 0.1% fee estimate
    return { entry: price, sizeTokens: sizeNum, sizeUsd, margin, liqPrice, fee };
  }, [size, leverage, direction, price]);

  const isLong = direction === 'long';

  const canTrade =
    connected &&
    priceReady &&
    orderSummary.sizeTokens > 0 &&
    !!slabAddress &&
    !submitting;

  const handleOpenPosition = useCallback(async () => {
    if (!canTrade || !slabAddress) return;

    Alert.alert(
      `Confirm ${direction.toUpperCase()} Position`,
      [
        `Market: ${symbol}`,
        `Size: ${orderSummary.sizeUsd.toFixed(2)} USD`,
        `Leverage: ${leverage}`,
        `Entry ~$${price.toFixed(2)}`,
        `Liq ~$${orderSummary.liqPrice.toFixed(2)}`,
        `Fee ~$${orderSummary.fee.toFixed(4)}`,
      ].join('\n'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: isLong ? 'default' : 'destructive',
          onPress: async () => {
            const result = await submitTrade({
              slabAddress,
              userIdx,
              sizeUsd: orderSummary.sizeUsd,
              direction,
            });

            if (result) {
              Alert.alert(
                '✅ Position Opened',
                `Tx: ${result.signature.slice(0, 16)}…`,
                [{ text: 'OK' }],
              );
              setSize(''); // reset form
            }
          },
        },
      ],
    );
  }, [canTrade, slabAddress, direction, orderSummary, leverage, price, symbol, userIdx, submitTrade, isLong]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{symbol}</Text>
        {priceReady ? (
          <Text style={[styles.price, { color: colors.long }]}>
            ${price.toFixed(price < 1 ? 6 : 2)} ↑
          </Text>
        ) : (
          <ActivityIndicator color={colors.accent} size="small" />
        )}
      </View>

      {tradeError && (
        <ErrorBanner message={tradeError} />
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Mini Chart Placeholder */}
        <Panel style={styles.chartPanel}>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartText}>📊 Chart</Text>
            {!priceReady && (
              <Text style={styles.chartSubText}>Loading price…</Text>
            )}
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
                isLong ? { color: '#ffffff' } : { color: colors.textMuted },
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
                !isLong ? { color: '#ffffff' } : { color: colors.textMuted },
              ]}
            >
              SHORT ▼
            </Text>
          </TouchableOpacity>
        </View>

        {/* Size Input */}
        <InputField
          label={`Size (${symbol.split('-')[0]})`}
          value={size}
          onChangeText={setSize}
          placeholder="0.00"
          keyboardType="decimal-pad"
          rightAction={{
            label: 'MAX',
            onPress: () => setSize('10.0'), // TODO: derive from wallet balance
          }}
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
          <SummaryRow
            label="Entry"
            value={priceReady ? `$${orderSummary.entry.toFixed(2)}` : '…'}
          />
          <SummaryRow
            label="Notional"
            value={
              orderSummary.sizeUsd > 0
                ? `$${orderSummary.sizeUsd.toFixed(2)}`
                : '—'
            }
          />
          <SummaryRow
            label="Margin"
            value={
              orderSummary.margin > 0
                ? `$${orderSummary.margin.toFixed(2)}`
                : '—'
            }
          />
          <SummaryRow
            label="Liq. Price"
            value={
              orderSummary.liqPrice > 0
                ? `$${orderSummary.liqPrice.toFixed(2)}`
                : '—'
            }
            valueColor={
              orderSummary.liqPrice > 0 ? colors.warning : colors.textMuted
            }
          />
          <SummaryRow
            label="Est. Fee"
            value={
              orderSummary.fee > 0 ? `$${orderSummary.fee.toFixed(4)}` : '—'
            }
          />
        </Panel>

        {/* Wallet not connected hint */}
        {!connected && (
          <Text style={styles.hint}>Connect your wallet to trade.</Text>
        )}

        {!slabAddress && connected && (
          <Text style={styles.hint}>
            Select a market from the Markets tab to trade.
          </Text>
        )}

        {/* CTA */}
        <TradeButton
          label={
            submitting
              ? 'Signing…'
              : `OPEN ${direction.toUpperCase()} POSITION`
          }
          direction={direction}
          fullWidth
          disabled={!canTrade}
          onPress={handleOpenPosition}
        />

        {submitting && (
          <View style={styles.signingRow}>
            <ActivityIndicator color={colors.accent} size="small" />
            <Text style={styles.signingText}>
              Waiting for wallet signature…
            </Text>
          </View>
        )}
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
      <Text
        style={[
          summaryStyles.value,
          valueColor ? { color: valueColor } : undefined,
        ]}
      >
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
    paddingBottom: 32,
  },
  chartPanel: { gap: 8 },
  chartPlaceholder: {
    height: 160,
    backgroundColor: colors.bgInset,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  chartText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  chartSubText: {
    fontFamily: fonts.body,
    fontSize: 11,
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
    flexWrap: 'wrap',
    gap: 6,
  },
  summaryPanel: {
    backgroundColor: colors.bgInset,
    gap: 2,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  signingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  signingText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
});
