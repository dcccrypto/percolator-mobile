/**
 * useTrades — fetches recent trades for a given market slab address.
 * Polls every 15 seconds and cleans up on unmount.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';

export interface Trade {
  side: 'long' | 'short';
  size: number;
  price: number;
  timestamp: string;
  signature?: string;
}

export interface UseTradesResult {
  trades: Trade[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const POLL_INTERVAL_MS = 15_000;

export function useTrades(slabAddress: string | undefined): UseTradesResult {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTrades = useCallback(async () => {
    if (!slabAddress) {
      setTrades([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await api.getTrades(slabAddress);
      setTrades(
        data.map((t) => ({
          side: t.side,
          size: t.size,
          price: t.price,
          timestamp: t.timestamp,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trades');
    } finally {
      setLoading(false);
    }
  }, [slabAddress]);

  const refresh = useCallback(() => {
    fetchTrades();
  }, [fetchTrades]);

  useEffect(() => {
    if (!slabAddress) {
      setTrades([]);
      return;
    }

    fetchTrades();

    intervalRef.current = setInterval(fetchTrades, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [slabAddress, fetchTrades]);

  return { trades, loading, error, refresh };
}
