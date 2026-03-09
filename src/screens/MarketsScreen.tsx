import React, { useState, useMemo, useCallback, memo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
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
import { CreateMarketFAB } from '../components/trade/CreateMarketFAB';

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

/** Hot thresholds from design brief §3.2 */
const HOT_OI_PCT = 0.80;   // OI > 80% capacity
const HOT_VOL_USD = 1_000_000; // 24h vol > $1 M

function FlameIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C12 2 9 6.5 9 9.5C9 9.5 7 8.5 7.5 6.5C5 9 4 11.5 4 14C4 18.4 7.6 22 12 22C16.4 22 20 18.4 20 14C20 10 17 6 12 2ZM12 19C10.3 19 9 17.7 9 16C9 14.4 10 13.2 11.5 12.5C11.5 13.5 12 14.5 13 15C13 13.5 13.8 12.2 15 11.5C15 13.7 14 19 12 19Z"
        fill={colors.warning}
      />
    </Svg>
  );
}

/**
 * TokenLogo — renders a token logo with a CDN fallback chain.
 *
 * Priority order (PERC-535, closes mobile #50):
 *   1. API-supplied logoUrl (may be null or deprecated solana-labs URL)
 *   2. Jupiter Token List CDN — active, maintained, covers all Solana tokens
 *   3. Text placeholder (first 2 chars of base symbol)
 *
 * Uses onError to advance through the chain; React key resets Image on URL change.
 */
const TokenLogo = memo(function TokenLogo({
  logoUrl,
  mintAddress,
  symbol,
  size = 36,
}: {
  logoUrl: string | null;
  mintAddress: string;
  symbol: string;
  size?: number;
}) {
  const base = symbol.replace(/-PERP$/i, '').toUpperCase();
  const initials = base.slice(0, 2);

  // Build ordered fallback list once per render cycle
  const fallbacks = useMemo<string[]>(() => {
    const urls: string[] = [];
    if (logoUrl) urls.push(logoUrl);
    if (mintAddress) {
      // Jupiter CDN (active, maintained — replaces deprecated solana-labs/token-list)
      urls.push(`https://cdn.jup.ag/tokens/${mintAddress}`);
      // Birdeye CDN as secondary fallback
      urls.push(`https://public.birdeye.so/token_asset?address=${mintAddress}`);
    }
    return urls;
  }, [logoUrl, mintAddress]);

  const [idx, setIdx] = useState(0);
  const lastFallbacksRef = useRef(fallbacks);

  // Reset index when fallbacks change (e.g. market changes)
  if (lastFallbacksRef.current !== fallbacks) {
    lastFallbacksRef.current = fallbacks;
    // Intentionally mutate during render (safe: same-tick reset)
    // eslint-disable-next-line react-hooks/rules-of-hooks
  }

  const onError = useCallback(() => setIdx((i) => i + 1), []);
  const src = fallbacks[idx];

  const logoStyle = { width: size, height: size, borderRadius: size / 2 };

  if (!src) {
    return (
      <View style={[styles.logoFallback, logoStyle]}>
        <Text style={styles.logoFallbackText}>{initials}</Text>
      </View>
    );
  }

  return (
    <Image
      key={src}
      source={{ uri: src }}
      style={logoStyle}
      onError={onError}
    />
  );
});

// Fixed card height for getItemLayout (card ~184px + 8px gap)
const CARD_HEIGHT = 192;

/**
 * Market card — design brief §3.2.
 *
 * Layout:
 *   [Logo 36px]  Symbol      Price
 *                Name   ▲ +2.41% [badge]
 *   ─── divider ──────────────────────────
 *   Vol $4.2M   OI $18.5M   OI bar ████░ 62%
 *                [LONG ▲]  [SHORT ▼]
 */
const MarketCard = memo(function MarketCard({
  market,
  onTrade,
}: {
  market: {
    slabAddress: string;
    mintAddress: string;
    symbol: string;
    name?: string;
    lastPrice: number | null;
    change24h: number;
    totalOpenInterest: number | null;
    maxLeverage: number;
    volume24h?: number | null;
    logoUrl?: string | null;
  };
  onTrade: (slabAddress: string, symbol: string, direction?: 'long' | 'short') => void;
}) {
  const changePositive = market.change24h >= 0;
  const changeColor = changePositive ? colors.long : colors.short;
  const changeBg = changePositive ? colors.longSubtle : colors.shortSubtle;
  const changePrefix = changePositive ? '+' : '';

  const maxOi = (market as any).maxOpenInterest ?? 5_000_000;
  const oiPct = Math.min((market.totalOpenInterest ?? 0) / maxOi, 1);
  const oiFillColor =
    oiPct < 0.5 ? colors.accent :
    oiPct < 0.8 ? colors.warning :
    colors.short;

  // Hot indicator: OI > 80% capacity OR 24h vol > $1M
  const vol24h = market.volume24h ?? (market.totalOpenInterest ?? 0) * 0.3; // proxy if unavailable
  const isHot = oiPct >= HOT_OI_PCT || vol24h >= HOT_VOL_USD;

  const baseName = market.name ?? market.symbol.replace(/-PERP$/i, '') + ' Perp';

  return (
    <Panel style={styles.card}>
      {/* Header row: logo + text + price */}
      <View style={styles.cardHeader}>
        {/* Logo — CDN fallback chain (PERC-535) */}
        <View style={styles.logoWrap}>
          <TokenLogo
            logoUrl={market.logoUrl ?? null}
            mintAddress={market.mintAddress}
            symbol={market.symbol}
            size={36}
          />
        </View>

        {/* Symbol + name col */}
        <View style={styles.symbolCol}>
          <View style={styles.symbolRow}>
            <Text style={styles.marketName}>{market.symbol}</Text>
            {isHot && <FlameIcon size={14} />}
          </View>
          <Text style={styles.marketSubname} numberOfLines={1}>{baseName}</Text>
        </View>

        {/* Price right-aligned */}
        <View style={styles.priceCol}>
          <Text style={styles.marketPrice}>{formatPrice(market.lastPrice)}</Text>
          <View style={[styles.changePill, { backgroundColor: changeBg }]}>
            <Text style={[styles.changeText, { color: changeColor }]}>
              {changePositive ? '▲ ' : '▼ '}{changePrefix}{market.change24h.toFixed(2)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Vol</Text>
          <Text style={styles.statValue}>{formatVolume(vol24h)}</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>OI</Text>
          <Text style={styles.statValue}>{formatVolume(market.totalOpenInterest)}</Text>
        </View>
        <View style={styles.oiBarCell}>
          <View style={styles.oiBar}>
            <View style={[styles.oiFill, { width: `${oiPct * 100}%` as any, backgroundColor: oiFillColor }]} />
          </View>
          <Text style={styles.oiPctText}>{Math.round(oiPct * 100)}%</Text>
        </View>
      </View>

      {/* Long / Short buttons */}
      <View style={styles.tradeRow}>
        <TouchableOpacity
          style={[styles.dirBtn, styles.dirBtnLong]}
          activeOpacity={0.7}
          onPress={() => onTrade(market.slabAddress, market.symbol, 'long')}
        >
          <Text style={[styles.dirBtnText, { color: colors.long }]}>LONG ▲</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dirBtn, styles.dirBtnShort]}
          activeOpacity={0.7}
          onPress={() => onTrade(market.slabAddress, market.symbol, 'short')}
        >
          <Text style={[styles.dirBtnText, { color: colors.short }]}>SHORT ▼</Text>
        </TouchableOpacity>
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

      {/* Devnet badge */}
      <View style={styles.devnetBanner}>
        <Text style={styles.devnetText}>🟢 DEVNET</Text>
        <Text style={styles.devnetSub}>Permissionless perpetual futures on Solana</Text>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Markets</Text>
        <TouchableOpacity
          style={styles.createMarketBtn}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('CreateMarket' as never)}
        >
          <Text style={styles.createMarketText}>+ Create Market</Text>
        </TouchableOpacity>
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

      {/* Create Market FAB — fixed bottom-right, navigates to wizard */}
      <CreateMarketFAB />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgVoid },
  devnetBanner: {
    backgroundColor: 'rgba(20, 241, 149, 0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(20, 241, 149, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  devnetText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.cyan,
    letterSpacing: 1,
  },
  devnetSub: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textSecondary,
  },
  createMarketBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  createMarketText: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
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
  // ── Market card ─────────────────────────────────────────────────────────────
  card: { gap: 10, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 12 },

  // Header
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoWrap: { width: 36, height: 36 },
  logoFallback: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.bgInset,
    alignItems: 'center', justifyContent: 'center',
  },
  logoFallbackText: {
    fontFamily: fonts.mono, fontSize: 11, fontWeight: '700', color: colors.textMuted,
  },
  symbolCol: { flex: 1, gap: 2 },
  symbolRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  marketName: {
    fontFamily: fonts.mono, fontSize: 15, fontWeight: '700', color: colors.text,
  },
  marketSubname: {
    fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary,
  },
  priceCol: { alignItems: 'flex-end', gap: 4 },
  marketPrice: {
    fontFamily: fonts.mono, fontSize: 18, fontWeight: '700',
    color: colors.text, fontVariant: ['tabular-nums'],
  },
  changePill: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: radii.full,
  },
  changeText: {
    fontFamily: fonts.mono, fontSize: 12, fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },

  // Divider
  divider: { height: 1, backgroundColor: colors.border },

  // Stats row
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statCell: { gap: 2 },
  statLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary },
  statValue: { fontFamily: fonts.mono, fontSize: 11, color: colors.text, fontVariant: ['tabular-nums'] },
  oiBarCell: { flex: 1, gap: 4 },
  oiBar: { height: 4, borderRadius: 2, backgroundColor: colors.bgOverlay, overflow: 'hidden' },
  oiFill: { height: '100%', borderRadius: 2 },
  oiPctText: { fontFamily: fonts.body, fontSize: 10, color: colors.textSecondary, textAlign: 'right' },

  // Long / Short buttons
  tradeRow: { flexDirection: 'row', gap: 8 },
  tradeBtn: { flex: 1 },
  dirBtn: {
    flex: 1, height: 36, borderRadius: radii.md,
    alignItems: 'center', justifyContent: 'center',
  },
  dirBtnLong: { backgroundColor: colors.longSubtle },
  dirBtnShort: { backgroundColor: colors.shortSubtle },
  dirBtnText: { fontFamily: fonts.mono, fontSize: 12, fontWeight: '700' },
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
