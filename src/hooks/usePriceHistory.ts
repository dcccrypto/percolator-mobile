import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';

interface UsePriceHistoryResult {
  /** Array of prices (most recent last) */
  prices: number[];
  /** Whether data is loading */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manual refresh */
  refresh: () => void;
}

/**
 * Fetches price history for a market slab.
 * Polls every 30 seconds when the slab address is provided.
 */
export function usePriceHistory(
  slabAddress: string | null | undefined,
): UsePriceHistoryResult {
  const [prices, setPrices] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetchedRef = useRef(false);

  const fetchPrices = useCallback(async () => {
    if (!slabAddress) return;

    try {
      if (!hasFetchedRef.current) setLoading(true); // Only show loading on first fetch
      const data = await api.getPriceHistory(slabAddress);

      if (data && data.length > 0) {
        // Extract last_price from price data, sorted chronologically
        const sorted = [...data].sort(
          (a, b) =>
            new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
        );
        setPrices(sorted.map((d) => d.last_price));
        setError(null);
        hasFetchedRef.current = true;
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load price history';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [slabAddress]);

  useEffect(() => {
    if (!slabAddress) {
      setPrices([]);
      setError(null);
      hasFetchedRef.current = false;
      return;
    }

    hasFetchedRef.current = false;
    fetchPrices();

    // Poll every 30s
    intervalRef.current = setInterval(fetchPrices, 30_000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [slabAddress, fetchPrices]);

  const refresh = useCallback(() => {
    fetchPrices();
  }, [fetchPrices]);

  return { prices, loading, error, refresh };
}
