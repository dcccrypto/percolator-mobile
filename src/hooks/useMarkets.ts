import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import * as SecureStore from 'expo-secure-store';

const MARKETS_CACHE_KEY = 'percolator_markets_cache';

interface Market {
  slabAddress: string;
  symbol: string;
  name: string;
  lastPrice: number | null;
  markPrice: number | null;
  fundingRate: number | null;
  totalOpenInterest: number | null;
  maxLeverage: number;
  tradingFeeBps: number;
  status: string;
  change24h: number;
  logoUrl: string | null;
}

function mapMarket(m: any): Market {
  return {
    slabAddress: m.slabAddress,
    symbol: m.symbol,
    name: m.name,
    lastPrice: m.lastPrice,
    markPrice: m.markPrice,
    fundingRate: m.fundingRate,
    totalOpenInterest: m.totalOpenInterest,
    maxLeverage: m.maxLeverage,
    tradingFeeBps: m.tradingFeeBps,
    status: m.status,
    change24h: 0,
    logoUrl: m.logoUrl ?? null,
  };
}

/**
 * Markets hook with AsyncStorage caching (PERC-505).
 * Shows cached data instantly on startup, then refreshes from API.
 */
export function useMarkets() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cacheLoadedRef = useRef(false);

  // Load cached markets on mount for instant first render
  useEffect(() => {
    let cancelled = false;
    SecureStore.getItemAsync(MARKETS_CACHE_KEY)
      .then((cached) => {
        if (cancelled || !cached || cacheLoadedRef.current) return;
        try {
          const parsed = JSON.parse(cached) as Market[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMarkets(parsed);
            cacheLoadedRef.current = true;
          }
        } catch {
          // Invalid cache, ignore
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const fetchMarkets = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getMarkets();
      const mapped = data.map(mapMarket);
      setMarkets(mapped);

      // Persist to cache for next startup (fire and forget)
      SecureStore.setItemAsync(MARKETS_CACHE_KEY, JSON.stringify(mapped)).catch(() => {});
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
