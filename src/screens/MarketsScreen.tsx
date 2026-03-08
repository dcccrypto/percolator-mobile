import React, { useState, useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { Panel } from '../components/ui/Panel';
import { FilterPill } from '../components/ui/FilterPill';
import { TradeButton } from '../components/ui/TradeButton';
import { MarketCardSkeleton } from '../components/ui/SkeletonLoader';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { useMarkets } from '../hooks/useMarkets';
import { useMarketStore } from '../store/marketStore';

const FILTERS = ['Hot 🔥', 'Newest', 'Volume ↓', 'OI ↓', 'Top Gainers'];

function formatPrice(price: number | null): string {
  if (price == null) return '$—.—';
  if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toPrecision(4)}`;
}

function formatVolume(oi: number | null): string {
  if (oi == null) return '—';
  if (oi >= 1_000_000) return `$${(oi / 1_000_000).toFixed(1)}M`;
  if (oi >= 1000) return `$${(oi / 1000).toFixed(0)}K`;
  return `$${oi.toFixed(0)}`;
}

// Fixed card height for getItemLayout (card ~184px + 8px gap)
const CARD_HEIGHT = 192;

const MarketCard = memo(function MarketCard({
  market,
  onTrade,
}: {
  market: {
    slabAddress: string;
    symbol: string;
    lastPrice: number | null;
    change24h: number;
    totalOpenInterest: number | null;
    maxLeverage: number;
  };
  onTrade: (slabAddress: string, symbol: string, direction?: 'long' | 'short') => void;
}) {
  const changeColor = market.change24h >= 0 ? colors.long : colors.short;
  const changePrefix = market.change24h >= 0 ? '+' : '';
  const maxOi = (market as any).maxOpenInterest ?? 5_000_000;
  const oiPct = Math.min((market.totalOpenInterest ?? 0) / maxOi, 1);
  const oiFillColor =
    oiPct < 0.5 ? colors.accent :
    oiPct < 0.8 ? colors.warning :
    colors.short;

  return (
    <Panel style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.marketName}>{market.symbol}</Text>
        <Text style={styles.marketPrice}>{formatPrice(market.lastPrice)}</Text>
      </View>

      <View style={styles.cardMeta}>
        <View style={[styles.changePill, { backgroundColor: changeColor + '14' }]}>
          <Text style={[styles.changeText, { color: changeColor }]}>
            {changePrefix}{market.change24h.toFixed(1)}%
          </Text>
        </View>
        <Text style={styles.volume}>OI: {formatVolume(market.totalOpenInterest)}</Text>
        <Text style={styles.leverage}>{market.maxLeverage}x max</Text>
      </View>

      <View style={styles.oiLabelRow}>
        <Text style={styles.oiLabel}>OI Utilization</Text>
        <Text style={styles.oiPctText}>{Math.round(oiPct * 100)}%</Text>
      </View>
      <View style={styles.oiBar}>
        <View style={[styles.oiFill, { width: `${oiPct * 100}%`, backgroundColor: oiFillColor }]} />
      </View>

      <View style={styles.tradeRow}>
        <TradeButton
          label="Long ▲"
          direction="long"
          size="sm"
          style={styles.tradeBtn}
          onPress={() => onTrade(market.slabAddress, market.symbol, 'long')}
        />
        <TradeButton
          label="Short ▼"
          direction="short"
          size="sm"
          style={styles.tradeBtn}
          onPress={() => onTrade(market.slabAddress, market.symbol, 'short')}
        />
      </View>
    </Panel>
  );
});

export function MarketsScreen() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('Hot 🔥');
  const { markets, loading, error, refetch } = useMarkets();
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<any>();
  const { setSelectedMarket } = useMarketStore();

  const handleTrade = useCallback((slabAddress: string, symbol: string, direction?: 'long' | 'short') => {
    setSelectedMarket({ slabAddress, symbol });
    navigation.navigate('Trade', direction ? { direction } : undefined);
  }, [setSelectedMarket, navigation]);

  const filteredMarkets = useMemo(() => {
    let result = [...markets];

    // Text search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) => m.symbol.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
      );
    }

    // Sort based on active filter
    switch (activeFilter) {
      case 'Hot 🔥':
        // Hot = highest 24h volume (OI × change combo proxy)
        result.sort(
          (a, b) =>
            (b.totalOpenInterest ?? 0) * Math.abs(b.change24h) -
            (a.totalOpenInterest ?? 0) * Math.abs(a.change24h),
        );
        break;
      case 'Newest':
        // Newest first — markets don't have createdAt yet; use array order (reverse)
        result.reverse();
        break;
      case 'Volume ↓':
        result.sort((a, b) => (b.totalOpenInterest ?? 0) - (a.totalOpenInterest ?? 0));
        break;
      case 'OI ↓':
        result.sort((a, b) => (b.totalOpenInterest ?? 0) - (a.totalOpenInterest ?? 0));
        break;
      case 'Top Gainers':
        result.sort((a, b) => b.change24h - a.change24h);
        break;
    }

    return result;
  }, [markets, search, activeFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {error && <ErrorBanner message={error} onRetry={refetch} />}

      <View style={styles.header}>
        <Text style={styles.title}>Markets</Text>
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search markets..."
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
        />
      </View>

      <FlatList
        data={FILTERS}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filters}
        contentContainerStyle={styles.filtersContent}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <FilterPill
            label={item}
            active={activeFilter === item}
            onPress={() => setActiveFilter(item)}
          />
        )}
      />

      {loading ? (
        <View style={styles.list}>
          {[1, 2, 3].map((i) => (
            <MarketCardSkeleton key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredMarkets}
          keyExtractor={(item) => item.slabAddress}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          getItemLayout={(_data, index) => ({
            length: CARD_HEIGHT,
            offset: CARD_HEIGHT * index + 16, // 16px list padding
            index,
          })}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item }) => <MarketCard market={item} onTrade={handleTrade} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {search ? `No markets matching "${search}"` : 'No markets available'}
              </Text>
              {search ? (
                <TouchableOpacity
                  style={styles.clearSearchBtn}
                  onPress={() => setSearch('')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.clearSearchText}>Clear Search</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgVoid },
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: colors.bgInset,
    borderRadius: radii.lg,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchIcon: { fontSize: 14 },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  filters: { maxHeight: 48, marginTop: 12 },
  filtersContent: { paddingHorizontal: 16, alignItems: 'center' },
  list: { padding: 16, gap: 8 },
  card: { gap: 10, marginBottom: 8 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  marketName: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  marketPrice: {
    fontFamily: fonts.mono,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  changePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  changeText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  volume: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  leverage: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
  },
  oiLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  oiLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  oiPctText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textSecondary,
  },
  oiBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bgOverlay,
    overflow: 'hidden',
  },
  oiFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  tradeRow: { flexDirection: 'row', gap: 8 },
  tradeBtn: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: 40, gap: 12 },
  clearSearchBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderActive,
  },
  clearSearchText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
});
