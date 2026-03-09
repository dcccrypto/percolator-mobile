import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { Panel } from '../components/ui/Panel';
import { InputField } from '../components/ui/InputField';
import { TradeButton } from '../components/ui/TradeButton';
import { FilterPill } from '../components/ui/FilterPill';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { MiniChart } from '../components/chart/MiniChart';
import { SuccessToast } from '../components/trade/SuccessToast';
import { useMWA } from '../hooks/useMWA';
import { usePriceStream as usePriceStreamMulti } from '../hooks/usePriceStream';
import { usePriceHistory, type Timeframe } from '../hooks/usePriceHistory';
import { useTrade } from '../hooks/useTrade';
import { usePriceFlash } from '../hooks/usePriceFlash';
import { useMarketStore } from '../store/marketStore';
import { useSettingsStore } from '../store/settingsStore';
import { useMarkets } from '../hooks/useMarkets';
import { useTrades } from '../hooks/useTrades';
import { useFunding } from '../hooks/useFunding';
import { useOpenInterest } from '../hooks/useOpenInterest';
import { useInsurance } from '../hooks/useInsurance';

type TradeRouteParams = {
  Trade: { direction?: 'long' | 'short' } | undefined;
};

const LEVERAGE_OPTIONS = ['1x', '2x', '5x', '10x', '20x'];

export function TradeScreen() {
  const route = useRoute<RouteProp<TradeRouteParams, 'Trade'>>();
  const { connected, publicKey, balance: walletBalance, refreshBalance } = useMWA();
  const { selectedMarket, userIdx } = useMarketStore();
  const settings = useSettingsStore();
  const { markets } = useMarkets();
  const slabAddress = selectedMarket?.slabAddress;
  const symbol = selectedMarket?.symbol ?? 'SOL-PERP';
  const currentMarket = useMemo(
    () => (slabAddress ? markets.find((m) => m.slabAddress === slabAddress) ?? null : null),
    [markets, slabAddress],
  );
  const { trades, loading: tradesLoading } = useTrades(slabAddress);
  const { hourlyRate, dailyRate } = useFunding(slabAddress);
  const { totalOI } = useOpenInterest(slabAddress);
  const { balance: insuranceBalance } = useInsurance(slabAddress);
  const { prices } = usePriceStreamMulti(slabAddress ? [slabAddress] : []);
  const livePrice = slabAddress ? prices[slabAddress]?.price ?? null : null;
  const { submitting, error: tradeError, submitTrade } = useTrade();
  const [selectedTfState, setSelectedTfState] = useState<Timeframe>('1h');
  const { prices: priceHistory, loading: chartLoading } = usePriceHistory(slabAddress, selectedTfState);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const chartHeight = Math.round(screenHeight * 0.40);

  // Default direction from nav params (when tapping Long/Short in MarketsScreen)
  const navDirection = route.params?.direction;
  const [direction, setDirection] = useState<'long' | 'short'>(navDirection ?? 'long');
  const [size, setSize] = useState('');
  // Use settings default leverage; fall back to '5x'
  const [leverage, setLeverage] = useState(settings.defaultLeverage || '5x');

  // Sync direction if navigated with a direction param
  useEffect(() => {
    if (navDirection) setDirection(navDirection);
  }, [navDirection]);

  // Load settings on mount
  useEffect(() => {
    if (!settings.loaded) settings.load();
  }, [settings.loaded]);

  // Use live streamed price, fall back to 0 while loading
  const price = livePrice ?? 0;
  const priceReady = price > 0;

  // Price flash effect (green/red on change)
  const priceFlash = usePriceFlash(livePrice);

  // Success toast state
  const [toast, setToast] = useState<{ visible: boolean; sig: string | null }>({
    visible: false,
    sig: null,
  });

  // Refresh wallet balance when entering trade screen
  useEffect(() => {
    if (connected && publicKey) {
      refreshBalance();
    }
  }, [connected, publicKey, refreshBalance]);

  // Parse slippage from settings (e.g. '0.5%' → 0.005)
  const slippagePct = useMemo(() => {
    const raw = parseFloat(settings.slippageTolerance) || 0.5;
    return raw / 100;
  }, [settings.slippageTolerance]);

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
    // Worst-case entry with slippage
    const entryWithSlippage =
      direction === 'long'
        ? price * (1 + slippagePct)
        : price * (1 - slippagePct);
    return { entry: price, entryWithSlippage, sizeTokens: sizeNum, sizeUsd, margin, liqPrice, fee, slippagePct };
  }, [size, leverage, direction, price, slippagePct]);

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
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setToast({ visible: true, sig: result.signature });
              setSize(''); // reset form
            }
          },
        },
      ],
    );
  }, [canTrade, slabAddress, direction, orderSummary, leverage, price, symbol, userIdx, submitTrade, isLong]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SuccessToast
        visible={toast.visible}
        txSignature={toast.sig}
        message={`${direction.toUpperCase()} position opened!`}
        onDismiss={() => setToast({ visible: false, sig: null })}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{symbol}</Text>
        {priceReady ? (
          <Text
            style={[
              styles.price,
              {
                color:
                  priceFlash === 'up'
                    ? colors.long
                    : priceFlash === 'down'
                    ? colors.short
                    : colors.text,
              },
            ]}
          >
            ${price.toFixed(price < 1 ? 6 : 2)}{' '}
            {priceFlash === 'up' ? '↑' : priceFlash === 'down' ? '↓' : ''}
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
        {/* Price Chart */}
        <Panel style={styles.chartPanel}>
          <MiniChart
            data={priceHistory}
            width={screenWidth - 64} // 16px padding * 2 + 16px panel padding * 2
            height={chartHeight}
            loading={chartLoading}
          />
          <View style={styles.timeframes}>
            {(['1m', '5m', '15m', '1h', '4h', '1D'] as Timeframe[]).map((tf) => (
              <TouchableOpacity
                key={tf}
                style={[
                  styles.tfBtn,
                  selectedTfState === tf && styles.tfBtnActive,
                ]}
                activeOpacity={0.7}
                onPress={() => setSelectedTfState(tf)}
              >
                <Text
                  style={[
                    styles.tfText,
                    selectedTfState === tf && styles.tfTextActive,
                  ]}
                >
                  {tf}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Panel>

        {/* Stats Row — horizontal scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statsRow}
          contentContainerStyle={styles.statsRowContent}
        >
          <StatCell
            label="Funding/h"
            value={
              hourlyRate != null
                ? `${hourlyRate.toFixed(4)}%`
                : currentMarket?.fundingRate != null
                  ? `${(currentMarket.fundingRate * 100).toFixed(4)}%`
                  : '—'
            }
            valueColor={
              (hourlyRate ?? currentMarket?.fundingRate ?? null) != null
                ? (hourlyRate ?? (currentMarket?.fundingRate ?? 0) * 100) >= 0
                  ? colors.long
                  : colors.short
                : undefined
            }
          />
          <StatCell
            label="Daily Rate"
            value={dailyRate != null ? `${dailyRate.toFixed(2)}%` : '—'}
            valueColor={
              dailyRate != null ? (dailyRate >= 0 ? colors.long : colors.short) : undefined
            }
          />
          <StatCell
            label="OI"
            value={
              totalOI != null
                ? formatLarge(totalOI)
                : currentMarket?.totalOpenInterest != null
                  ? formatLarge(currentMarket.totalOpenInterest)
                  : '—'
            }
          />
          <StatCell
            label="Insurance"
            value={insuranceBalance != null ? formatLarge(insuranceBalance) : '—'}
          />
          <StatCell
            label="Mark"
            value={
              currentMarket?.markPrice != null
                ? `$${currentMarket.markPrice.toFixed(currentMarket.markPrice < 1 ? 6 : 2)}`
                : priceReady
                ? `$${price.toFixed(price < 1 ? 6 : 2)}`
                : '—'
            }
          />
          <StatCell
            label="Index"
            value={priceReady ? `$${price.toFixed(price < 1 ? 6 : 2)}` : '—'}
          />
          <StatCell
            label="Volume"
            value={
              currentMarket?.totalOpenInterest != null
                ? formatLarge(currentMarket.totalOpenInterest * 0.3)
                : '—'
            }
          />
          <StatCell
            label="Spread"
            value={
              priceReady && currentMarket?.markPrice != null
                ? `$${Math.abs(currentMarket.markPrice - price).toFixed(price < 1 ? 6 : 2)}`
                : '—'
            }
          />
          <StatCell
            label="24h"
            value={
              currentMarket != null
                ? `${currentMarket.change24h >= 0 ? '+' : ''}${currentMarket.change24h.toFixed(2)}%`
                : '—'
            }
            valueColor={
              currentMarket != null
                ? currentMarket.change24h >= 0
                  ? colors.long
                  : colors.short
                : undefined
            }
          />
          <StatCell
            label="Fee"
            value={
              currentMarket?.tradingFeeBps != null
                ? `${(currentMarket.tradingFeeBps / 100).toFixed(2)}%`
                : '—'
            }
          />
        </ScrollView>

        {/* Direction Toggle */}
        <View style={styles.directionToggle}>
          <TouchableOpacity
            style={[
              styles.directionBtn,
              isLong
                ? { backgroundColor: colors.longSubtle, borderColor: colors.long + '40', borderWidth: 1 }
                : null,
            ]}
            onPress={() => {
              setDirection('long');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.directionText,
                { color: isLong ? colors.long : colors.textMuted },
              ]}
            >
              LONG ▲
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.directionBtn,
              !isLong
                ? { backgroundColor: colors.shortSubtle, borderColor: colors.short + '40', borderWidth: 1 }
                : null,
            ]}
            onPress={() => {
              setDirection('short');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.directionText,
                { color: !isLong ? colors.short : colors.textMuted },
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
            onPress: () => {
              if (walletBalance != null && walletBalance > 0 && price > 0) {
                // Reserve 0.01 SOL for tx fees, convert balance to token units
                const usable = Math.max(walletBalance - 0.01, 0);
                const levNum = parseInt(leverage) || 5;
                // Max token size = (usable SOL value in USD equivalent) * leverage / price
                // For simplicity: if trading SOL perp, usable is the token amount directly
                setSize(usable.toFixed(4));
              } else {
                setSize('10.0'); // Fallback
              }
            },
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
          <SummaryRow
            label="Slippage"
            value={`${(orderSummary.slippagePct * 100).toFixed(1)}%`}
            valueColor={colors.textSecondary}
          />
        </Panel>

        {/* Recent Trades */}
        <Panel style={{ gap: 4 }}>
          <Text style={styles.label}>Recent Trades</Text>
          {trades.slice(0, 10).map((t, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: t.side === 'long' ? colors.long : colors.short }}>
                {t.side === 'long' ? '●' : '●'} ${t.price?.toFixed(2) ?? '—'}
              </Text>
              <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted }}>
                {t.size?.toFixed(4) ?? '—'}
              </Text>
            </View>
          ))}
          {trades.length === 0 && !tradesLoading && (
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>No recent trades</Text>
          )}
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

function formatLarge(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function StatCell({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={statCellStyles.cell}>
      <Text style={statCellStyles.label}>{label}</Text>
      <Text style={[statCellStyles.value, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

const statCellStyles = StyleSheet.create({
  cell: {
    minWidth: 72,
    paddingHorizontal: 12,
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textSecondary,
  },
  value: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
});

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
  tfBtnActive: {
    backgroundColor: colors.accent,
  },
  tfText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textSecondary,
  },
  tfTextActive: {
    color: colors.text,
  },
  directionToggle: {
    flexDirection: 'row',
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: colors.bgInset,
    overflow: 'hidden',
    padding: 4,
    gap: 4,
  },
  directionBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.md,
  },
  statsRow: {
    backgroundColor: colors.bgInset,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    height: 44,  // design brief §4.2
  },
  statsRowContent: {
    alignItems: 'center',
    paddingVertical: 0,
    height: 44,
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
    gap: 8,
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
