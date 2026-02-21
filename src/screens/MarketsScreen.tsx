import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/fonts';
import { Panel } from '../components/ui/Panel';
import { FilterPill } from '../components/ui/FilterPill';
import { TradeButton } from '../components/ui/TradeButton';

interface Market {
  id: string;
  name: string;
  price: string;
  change24h: number;
  volume: string;
  openInterest: string;
  oiPercent: number;
}

const MOCK_MARKETS: Market[] = [
  { id: '1', name: 'SOL-PERP', price: '$148.32', change24h: 5.2, volume: '$2.4M', openInterest: '$1M', oiPercent: 0.7 },
  { id: '2', name: 'ETH-PERP', price: '$2,847.10', change24h: -1.8, volume: '$890K', openInterest: '$450K', oiPercent: 0.45 },
  { id: '3', name: 'BTC-PERP', price: '$67,420.00', change24h: 2.1, volume: '$5.1M', openInterest: '$3M', oiPercent: 0.85 },
  { id: '4', name: 'BONK-PERP', price: '$0.00001892', change24h: 12.4, volume: '$320K', openInterest: '$180K', oiPercent: 0.35 },
];

const FILTERS = ['Hot 🔥', 'Newest', 'Volume ↓', 'OI ↓', 'Top Gainers'];

function MarketCard({ market }: { market: Market }) {
  const changeColor = market.change24h >= 0 ? colors.long : colors.short;
  const changePrefix = market.change24h >= 0 ? '+' : '';

  return (
    <Panel style={styles.card}>
      {/* Row 1: Name + Price */}
      <View style={styles.cardHeader}>
        <Text style={styles.marketName}>{market.name}</Text>
        <Text style={styles.marketPrice}>{market.price}</Text>
      </View>

      {/* Row 2: Change + Volume */}
      <View style={styles.cardMeta}>
        <View style={[styles.changePill, { backgroundColor: changeColor + '14' }]}>
          <Text style={[styles.changeText, { color: changeColor }]}>
            {changePrefix}{market.change24h.toFixed(1)}%
          </Text>
        </View>
        <Text style={styles.volume}>Vol: {market.volume}</Text>
      </View>

      {/* Row 3: OI bar */}
      <View style={styles.oiRow}>
        <View style={styles.oiBar}>
          <View
            style={[styles.oiFill, { width: `${market.oiPercent * 100}%` }]}
          />
        </View>
        <Text style={styles.oiLabel}>OI: {market.openInterest}</Text>
      </View>

      {/* Row 4: Quick trade */}
      <View style={styles.tradeRow}>
        <TradeButton label="Long ▲" direction="long" size="sm" style={styles.tradeBtn} />
        <TradeButton label="Short ▼" direction="short" size="sm" style={styles.tradeBtn} />
      </View>
    </Panel>
  );
}

export function MarketsScreen() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('Hot 🔥');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Markets</Text>
      </View>

      {/* Search */}
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

      {/* Filters */}
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

      {/* Market List */}
      <FlatList
        data={MOCK_MARKETS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <MarketCard market={item} />}
      />
    </SafeAreaView>
  );
}

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
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  filters: {
    maxHeight: 48,
    marginTop: 12,
  },
  filtersContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  list: {
    padding: 16,
    gap: 8,
  },
  // Market Card
  card: {
    gap: 10,
    marginBottom: 8,
  },
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
  oiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  oiBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  oiFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  oiLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  tradeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tradeBtn: {
    flex: 1,
  },
});
