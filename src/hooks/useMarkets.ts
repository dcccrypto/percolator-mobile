import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
// Module-level cache — survives within app session, no size limit (#67)
// SecureStore has 2048-byte limit which markets data easily exceeds.
let _marketsCache: Market[] | null = null;

interface Market {
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
  status: string;
  change24h: number;
  logoUrl: string | null;
}

function mapMarket(m: any): Market {
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
