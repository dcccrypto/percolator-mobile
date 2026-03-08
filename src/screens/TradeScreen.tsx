import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { colors, radii, spacing } from '../theme/tokens';
import { fonts, typography } from '../theme/fonts';
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

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type TradeRouteParams = {
  Trade: { direction?: 'long' | 'short' } | undefined;
};

const LEVERAGE_OPTIONS = ['1x', '2x', '5x', '10x', '20x'];
const SIZE_PRESETS = [
  { label: '25%', fraction: 0.25 },
  { label: '50%', fraction: 0.5 },
  { label: '75%', fraction: 0.75 },
  { label: 'MAX', fraction: 1.0 },
];
const CHART_MINI_HEIGHT = 60;

export function TradeScreen() {
  const route = useRoute<RouteProp<TradeRouteParams, 'Trade'>>();
  const { connected, publicKey } = useMWA();
  const { selectedMarket, userIdx } = useMarketStore();
  const settings = useSettingsStore();
  const { markets } = useMarkets();
  const slabAddress = selectedMarket?.slabAddress;
  const symbol = selectedMarket?.symbol ?? 'SOL-PERP';
  const currentMarket = useMemo(
    () => (slabAddress ? markets.find((m) => m.slabAddress === slabAddress) ?? null : null),
    [markets, slabAddress],
  );
  const { prices } = usePriceStreamMulti(slabAddress ? [slabAddress] : []);
  const livePrice = slabAddress ? prices[slabAddress]?.price ?? null : null;
  const { submitting, error: tradeError, submitTrade } = useTrade();
  const [selectedTfState, setSelectedTfState] = useState<Timeframe>('1h');
  const { prices: priceHistory, loading: chartLoading } = usePriceHistory(slabAddress, selectedTfState);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Chart collapse state
  const [chartCollapsed, setChartCollapsed] = useState(false);
  const chartHeight = chartCollapsed ? CHART_MINI_HEIGHT : Math.round(screenHeight * 0.35);

  // Default direction from nav params (when tapping Long/Short in MarketsScreen)
  const navDirection = route.params?.direction;
  const [direction, setDirection] = useState<'long' | 'short'>(navDirection ?? 'long');
  const [size, setSize] = useState('');
  // Use settings default leverage; fall back to '5x'
  const [leverage, setLeverage] = useState(settings.defaultLeverage || '5x');

  // Order summary collapsed state
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  // Price flash animation
  const flashAnim = useRef(new Animated.Value(1)).current;

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

  // Trigger flash animation on price change
  useEffect(() => {
    if (priceFlash === 'up' || priceFlash === 'down') {
      flashAnim.setValue(0.6);
      Animated.timing(flashAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [priceFlash, flashAnim]);

  // Success toast state
  const [toast, setToast] = useState<{ visible: boolean; sig: string | null }>({
    visible: false,
    sig: null,
  });

  // Wallet balance for MAX button (derive from collateral)
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  useEffect(() => {
    if (!connected || !publicKey || !slabAddress) {
      setWalletBalance(null);
      return;
    }
    // Fetch wallet token balance asynchronously
    import('../lib/solana').then(({ connection }) => {
      import('@solana/web3.js').then(({ PublicKey: PK }) => {
        connection
          .getBalance(publicKey)
          .then((lamports) => {
            // Convert lamports to SOL
            setWalletBalance(lamports / 1e9);
          })
          .catch(() => setWalletBalance(null));
      });
    });
  }, [connected, publicKey, slabAddress]);

  // Parse slippage from settings (e.g. '0.5%' -> 0.005)
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
    // Simplified liq estimate: entry +/- entry/leverage
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

  // USD value display under size input
  const sizeUsdDisplay = useMemo(() => {
    const sizeNum = parseFloat(size) || 0;
    if (sizeNum <= 0 || !priceReady) return null;
    return (sizeNum * price).toFixed(2);
  }, [size, price, priceReady]);

  // 24h change
  const change24h = currentMarket?.change24h ?? null;
  const changePositive = change24h != null ? change24h >= 0 : null;

  const handleSizePreset = useCallback(
    (fraction: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (walletBalance != null && walletBalance > 0 && price > 0) {
        // Reserve 0.01 SOL for tx fees
        const usable = Math.max(walletBalance - 0.01, 0);
        const amount = usable * fraction;
        setSize(amount.toFixed(4));
      } else {
        // Fallback
        const fallback = 10.0 * fraction;
        setSize(fallback.toFixed(2));
      }
    },
    [walletBalance, price],
  );

  const toggleChartCollapse = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setChartCollapsed((prev) => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const toggleSummary = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSummaryExpanded((prev) => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

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

  const levNum = parseInt(leverage) || 5;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SuccessToast
        visible={toast.visible}
        txSignature={toast.sig}
        message={`${direction.toUpperCase()} position opened!`}
        onDismiss={() => setToast({ visible: false, sig: null })}
      />

      {/* ========== 1. MARKET HEADER BAR (sticky) ========== */}
      <View style={styles.headerBar}>
        {/* Left: Market symbol as dropdown-like touchable */}
        <TouchableOpacity style={styles.marketSelector} activeOpacity={0.7}>
          <Text style={styles.marketSymbol}>{symbol}</Text>
          <Text style={styles.marketDropdownArrow}>{'\u25BC'}</Text>
        </TouchableOpacity>

        {/* Center: Large live price with flash */}
        <View style={styles.headerPriceWrap}>
          {priceReady ? (
            <Animated.Text
              style={[
                styles.headerPrice,
                {
                  color:
                    priceFlash === 'up'
                      ? colors.long
                      : priceFlash === 'down'
                      ? colors.short
                      : colors.text,
                  opacity: flashAnim,
                },
              ]}
            >
              ${price.toFixed(price < 1 ? 6 : 2)}
            </Animated.Text>
          ) : (
            <ActivityIndicator color={colors.accent} size="small" />
          )}
        </View>

        {/* Right: 24h change badge */}
        {change24h != null ? (
          <View
            style={[
              styles.changeBadge,
              {
                backgroundColor: changePositive ? colors.longSubtle : colors.shortSubtle,
              },
            ]}
          >
            <Text
              style={[
                styles.changeBadgeText,
                { color: changePositive ? colors.long : colors.short },
              ]}
            >
              {changePositive ? '+' : ''}{change24h.toFixed(2)}%
            </Text>
          </View>
        ) : (
          <View style={styles.changeBadgePlaceholder} />
        )}
      </View>

      {tradeError && <ErrorBanner message={tradeError} />}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ========== 2. CHART SECTION ========== */}
        <View style={styles.chartSection}>
          <MiniChart
            data={priceHistory}
            width={screenWidth - 32}
            height={chartHeight}
            loading={chartLoading}
          />

          {/* Timeframe pills + collapse toggle */}
          <View style={styles.chartControls}>
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

            <TouchableOpacity
              style={styles.collapseToggle}
              onPress={toggleChartCollapse}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.collapseText}>
                {chartCollapsed ? '\u25B4 Expand' : '\u25BE Collapse'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ========== 3. QUICK STATS STRIP ========== */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statsRow}
          contentContainerStyle={styles.statsRowContent}
        >
          <StatCell
            label="Funding"
            value={
              currentMarket?.fundingRate != null
                ? `${(currentMarket.fundingRate * 100).toFixed(4)}%`
                : '\u2014'
            }
            valueColor={
              currentMarket?.fundingRate != null
                ? currentMarket.fundingRate >= 0
                  ? colors.long
                  : colors.short
                : undefined
            }
          />
          <StatCell
            label="OI"
            value={
              currentMarket?.totalOpenInterest != null
                ? formatLarge(currentMarket.totalOpenInterest)
                : '\u2014'
            }
          />
          <StatCell
            label="Mark"
            value={
              currentMarket?.markPrice != null
                ? `$${currentMarket.markPrice.toFixed(currentMarket.markPrice < 1 ? 6 : 2)}`
                : priceReady
                ? `$${price.toFixed(price < 1 ? 6 : 2)}`
                : '\u2014'
            }
          />
          <StatCell
            label="Index"
            value={priceReady ? `$${price.toFixed(price < 1 ? 6 : 2)}` : '\u2014'}
          />
        </ScrollView>

        {/* ========== 4. DIRECTION TOGGLE ========== */}
        <View style={styles.directionToggle}>
          <TouchableOpacity
            style={[
              styles.directionBtn,
              isLong
                ? {
                    backgroundColor: colors.longSubtle,
                    borderColor: colors.long + '60',
                    borderWidth: 1.5,
                  }
                : { borderColor: 'transparent', borderWidth: 1.5 },
            ]}
            onPress={() => {
              setDirection('long');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.directionLabel,
                { color: isLong ? colors.long : colors.textMuted },
              ]}
            >
              Long
            </Text>
            <Text
              style={[
                styles.directionArrow,
                { color: isLong ? colors.long : colors.textMuted },
              ]}
            >
              {'\u25B2'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.directionBtn,
              !isLong
                ? {
                    backgroundColor: colors.shortSubtle,
                    borderColor: colors.short + '60',
                    borderWidth: 1.5,
                  }
                : { borderColor: 'transparent', borderWidth: 1.5 },
            ]}
            onPress={() => {
              setDirection('short');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.directionLabel,
                { color: !isLong ? colors.short : colors.textMuted },
              ]}
            >
              Short
            </Text>
            <Text
              style={[
                styles.directionArrow,
                { color: !isLong ? colors.short : colors.textMuted },
              ]}
            >
              {'\u25BC'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ========== 5. ORDER FORM ========== */}
        <View style={styles.orderForm}>
          {/* Size Input with USD subtext */}
          <View style={styles.sizeSection}>
            <InputField
              label={`Size (${symbol.split('-')[0]})`}
              value={size}
              onChangeText={setSize}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            {sizeUsdDisplay && (
              <Text style={styles.sizeUsdHint}>
                {'\u2248'} ${sizeUsdDisplay} USD
              </Text>
            )}

            {/* Quick size buttons */}
            <View style={styles.sizePresets}>
              {SIZE_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  style={styles.sizePresetBtn}
                  onPress={() => handleSizePreset(preset.fraction)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sizePresetText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Leverage */}
          <View style={styles.leverageSection}>
            <View style={styles.leverageHeader}>
              <Text style={styles.label}>Leverage</Text>
              <Text style={styles.leverageValue}>{leverage}</Text>
            </View>
            <View style={styles.leveragePills}>
              {LEVERAGE_OPTIONS.map((lev) => (
                <FilterPill
                  key={lev}
                  label={lev}
                  active={leverage === lev}
                  onPress={() => {
                    setLeverage(lev);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                />
              ))}
            </View>
          </View>
        </View>

        {/* ========== 6. ORDER SUMMARY (collapsible) ========== */}
        <TouchableOpacity
          style={styles.summaryContainer}
          onPress={toggleSummary}
          activeOpacity={0.85}
        >
          <Panel style={styles.summaryPanel}>
            {/* Collapsed preview line */}
            <View style={styles.summaryPreview}>
              <Text style={styles.summaryPreviewText}>
                Entry ~${priceReady ? orderSummary.entry.toFixed(2) : '...'}
                {'  |  '}
                Liq ~${orderSummary.liqPrice > 0 ? orderSummary.liqPrice.toFixed(2) : '...'}
              </Text>
              <Text style={styles.summaryChevron}>
                {summaryExpanded ? '\u25B4' : '\u25BE'}
              </Text>
            </View>

            {/* Expanded details */}
            {summaryExpanded && (
              <View style={styles.summaryExpanded}>
                <View style={styles.summarySeparator} />
                <SummaryRow
                  label="Entry"
                  value={priceReady ? `$${orderSummary.entry.toFixed(2)}` : '\u2026'}
                />
                <SummaryRow
                  label="Notional"
                  value={
                    orderSummary.sizeUsd > 0
                      ? `$${orderSummary.sizeUsd.toFixed(2)}`
                      : '\u2014'
                  }
                />
                <SummaryRow
                  label="Margin"
                  value={
                    orderSummary.margin > 0
                      ? `$${orderSummary.margin.toFixed(2)}`
                      : '\u2014'
                  }
                />
                <SummaryRow
                  label="Liq. Price"
                  value={
                    orderSummary.liqPrice > 0
                      ? `$${orderSummary.liqPrice.toFixed(2)}`
                      : '\u2014'
                  }
                  valueColor={
                    orderSummary.liqPrice > 0 ? colors.warning : colors.textMuted
                  }
                />
                <SummaryRow
                  label="Est. Fee"
                  value={
                    orderSummary.fee > 0 ? `$${orderSummary.fee.toFixed(4)}` : '\u2014'
                  }
                />
                <SummaryRow
                  label="Slippage"
                  value={`${(orderSummary.slippagePct * 100).toFixed(1)}%`}
                  valueColor={colors.textSecondary}
                />
              </View>
            )}
          </Panel>
        </TouchableOpacity>

        {/* Wallet not connected hint */}
        {!connected && (
          <Text style={styles.hint}>Connect your wallet to trade.</Text>
        )}

        {!slabAddress && connected && (
          <Text style={styles.hint}>
            Select a market from the Markets tab to trade.
          </Text>
        )}

        {/* ========== 7. TRADE CTA BUTTON ========== */}
        <View style={styles.ctaWrap}>
          {submitting ? (
            <View
              style={[
                styles.ctaButton,
                { backgroundColor: isLong ? colors.long : colors.short, opacity: 0.7 },
              ]}
            >
              <ActivityIndicator color={colors.bgVoid} size="small" />
              <Text style={styles.ctaButtonText}>Signing...</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.ctaButton,
                {
                  backgroundColor: isLong ? colors.long : colors.short,
                },
                !canTrade && styles.ctaDisabled,
              ]}
              onPress={handleOpenPosition}
              disabled={!canTrade}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaButtonText}>
                {isLong ? 'Open Long \u25B2' : 'Open Short \u25BC'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom spacer */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ================================================================
   HELPER COMPONENTS
   ================================================================ */

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
    minWidth: 64,
    paddingHorizontal: 10,
    justifyContent: 'center',
    gap: 1,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontFamily: fonts.mono,
    fontSize: 11,
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
    paddingVertical: 3,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  value: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
});

/* ================================================================
   STYLES
   ================================================================ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgVoid,
  },

  /* -- 1. Market Header Bar -- */
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgVoid,
  },
  marketSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingRight: 8,
  },
  marketSymbol: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  marketDropdownArrow: {
    fontFamily: fonts.body,
    fontSize: 8,
    color: colors.textSecondary,
    marginTop: 1,
  },
  headerPriceWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPrice: {
    fontFamily: fonts.mono,
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  changeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  changeBadgePlaceholder: {
    width: 64,
  },

  /* -- Scroll -- */
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },

  /* -- 2. Chart Section -- */
  chartSection: {
    gap: 6,
  },
  chartControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeframes: {
    flexDirection: 'row',
    gap: 3,
  },
  tfBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.bgElevated,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tfBtnActive: {
    backgroundColor: colors.accent,
  },
  tfText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textSecondary,
  },
  tfTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
  collapseToggle: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  collapseText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textSecondary,
  },

  /* -- 3. Quick Stats Strip -- */
  statsRow: {
    backgroundColor: colors.bgInset,
    borderRadius: radii.md,
    maxHeight: 48,
  },
  statsRowContent: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },

  /* -- 4. Direction Toggle -- */
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.md,
    gap: 6,
    minHeight: 44,
  },
  directionLabel: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  directionArrow: {
    fontSize: 10,
  },

  /* -- 5. Order Form -- */
  orderForm: {
    gap: 14,
  },
  sizeSection: {
    gap: 6,
  },
  sizeUsdHint: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textSecondary,
    paddingLeft: 4,
    fontVariant: ['tabular-nums'],
  },
  sizePresets: {
    flexDirection: 'row',
    gap: 6,
  },
  sizePresetBtn: {
    flex: 1,
    height: 36,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sizePresetText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  leverageSection: {
    gap: 8,
  },
  leverageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  leverageValue: {
    fontFamily: fonts.mono,
    fontSize: 20,
    fontWeight: '700',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  leveragePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },

  /* -- 6. Order Summary -- */
  summaryContainer: {},
  summaryPanel: {
    backgroundColor: colors.bgInset,
    padding: 12,
    gap: 0,
  },
  summaryPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 28,
  },
  summaryPreviewText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  summaryChevron: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryExpanded: {
    gap: 2,
    marginTop: 4,
  },
  summarySeparator: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 6,
  },

  /* -- Hint text -- */
  hint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16,
  },

  /* -- 7. Trade CTA -- */
  ctaWrap: {
    marginTop: 4,
  },
  ctaButton: {
    height: 56,
    borderRadius: radii.xl,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  ctaButtonText: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.bgVoid,
    letterSpacing: 0.5,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
});
