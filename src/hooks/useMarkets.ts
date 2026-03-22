import { useState, useEffect, useCallback, useRef } from 'react';
import { api, type MarketData } from '../lib/api';
// Module-level cache — survives within app session, no size limit (#67)
// SecureStore has 2048-byte limit which markets data easily exceeds.
let _marketsCache: Market[] | null = null;

/**
 * Consumer-facing market shape used throughout the mobile app.
 * Derived from MarketData (api.ts) via mapMarket().
 */
export interface Market {
  slabAddress: string;
  mintAddress: string;
  symbol: string;
  name: string;
  lastPrice: number | null;
  markPrice: number | null;
  fundingRate: number | null;
  totalOpenInterest: number | null;
  maxLeverage: number;
  tradingFeeBps: number;
  /** 'active' | 'zombie' — derived from is_zombie */
  status: string;
  /** Always 0 — API does not return 24h change; computed field reserved for future */
  change24h: number;
  logoUrl: string | null;
  decimals: number;
  /** 24h volume in USD (volume_24h_usd when available, else raw volume_24h) */
  volume24h: number | null;
  isZombie: boolean;
  /** ISO-8601 timestamp when the market was created (from created_at), or null */
  createdAt: string | null;
}

/**
 * Map a normalised MarketData (camelCase, from api.getMarkets()) to the
 * local Market shape. api.ts now handles the snake_case → camelCase conversion,
 * so all fields are already correctly named here.
 */
function mapMarket(m: MarketData): Market {
  return {
    slabAddress: m.slabAddress,
    mintAddress: m.mintAddress ?? '',
    symbol: m.symbol,
    name: m.name,
    lastPrice: m.lastPrice,
    markPrice: m.markPrice,
    fundingRate: m.fundingRate,
    totalOpenInterest: m.totalOpenInterest,
    maxLeverage: m.maxLeverage,
    tradingFeeBps: m.tradingFeeBps,
    status: m.status,
    change24h: 0, // API does not return a 24h change percentage
    logoUrl: m.logoUrl ?? null,
    decimals: m.decimals ?? 6,
    volume24h: m.volume24h ?? null,
    isZombie: m.isZombie ?? false,
    createdAt: m.createdAt ?? null,
  };
}

/**
 * Markets hook with module-level caching (PERC-505).
 * Shows cached data instantly on startup, then refreshes from API.
 */
export function useMarkets() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cacheLoadedRef = useRef(false);

  // Load cached markets on mount for instant first render
  useEffect(() => {
    if (_marketsCache && _marketsCache.length > 0 && !cacheLoadedRef.current) {
      setMarkets(_marketsCache);
      cacheLoadedRef.current = true;
    }
  }, []);

  const fetchMarkets = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getMarkets();
      const mapped = data.map(mapMarket);
      setMarkets(mapped);

      // Persist to module-level cache for tab switches
      _marketsCache = mapped;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load markets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return { markets, loading, error, refetch: fetchMarkets };
}
