import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

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
  change24h: number; // computed client-side or from API
}

export function useMarkets() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getMarkets();
      setMarkets(
        data.map((m) => ({
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
          change24h: 0, // TODO: compute from price history
        }))
      );
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
