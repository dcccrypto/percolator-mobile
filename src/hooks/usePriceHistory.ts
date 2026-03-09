import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';

/** Supported chart timeframes */
export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D';

/** Map timeframe labels to durations in milliseconds for data windowing */
const TIMEFRAME_DURATIONS: Record<Timeframe, number> = {
  '1m': 60 * 60 * 1000, // 1 hour of 1m candles
  '5m': 6 * 60 * 60 * 1000, // 6 hours
  '15m': 24 * 60 * 60 * 1000, // 1 day
  '1h': 7 * 24 * 60 * 60 * 1000, // 7 days
  '4h': 30 * 24 * 60 * 60 * 1000, // 30 days
  '1D': 90 * 24 * 60 * 60 * 1000, // 90 days
};

/** Poll interval by timeframe — shorter intervals for shorter timeframes */
const POLL_INTERVALS: Record<Timeframe, number> = {
  '1m': 10_000,
  '5m': 15_000,
  '15m': 30_000,
  '1h': 30_000,
  '4h': 60_000,
  '1D': 120_000,
};

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
 * Refetches when slabAddress or timeframe changes.
 * Polls at an interval appropriate to the selected timeframe.
 */
export function usePriceHistory(
  slabAddress: string | null | undefined,
  timeframe: Timeframe = '1h',
): UsePriceHistoryResult {
  const [prices, setPrices] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetchedRef = useRef(false);

  const fetchPrices = useCallback(async () => {
    if (!slabAddress) return;

    try {
      if (!hasFetchedRef.current) setLoading(true);
      const data = await api.getPriceHistory(slabAddress);

      if (data && data.length > 0) {
        // Sort chronologically
        const sorted = [...data].sort(
          (a, b) =>
            new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
        );

        // Window data to the selected timeframe duration
        const cutoff = Date.now() - TIMEFRAME_DURATIONS[timeframe];
        const windowed = sorted.filter(
          (d) => new Date(d.updated_at).getTime() >= cutoff,
        );

        // Use windowed data if we have enough points, otherwise fall back to all data
        const finalData = windowed.length >= 2 ? windowed : sorted;

        setPrices(finalData.map((d) => d.last_price).filter((v) => Number.isFinite(v)));
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
  }, [slabAddress, timeframe]);

  useEffect(() => {
    if (!slabAddress) {
      setPrices([]);
      setError(null);
      hasFetchedRef.current = false;
      return;
    }

    // Reset on slab or timeframe change
    hasFetchedRef.current = false;
    fetchPrices();

    // Poll at timeframe-appropriate interval
    const pollMs = POLL_INTERVALS[timeframe];
    intervalRef.current = setInterval(fetchPrices, pollMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [slabAddress, timeframe, fetchPrices]);

  const refresh = useCallback(() => {
    fetchPrices();
  }, [fetchPrices]);

  return { prices, loading, error, refresh };
}
