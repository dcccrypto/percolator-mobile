import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';

interface OIHistoryPoint {
  timestamp: string;
  oi: number;
}

interface UseOpenInterestResult {
  totalOI: number | null;
  history: OIHistoryPoint[];
  loading: boolean;
}

const POLL_INTERVAL = 30_000; // 30 seconds

/**
 * Hook to fetch open interest data with history for a given slab.
 * Polls every 30 seconds.
 */
export function useOpenInterest(slabAddress: string | undefined): UseOpenInterestResult {
  const [totalOI, setTotalOI] = useState<number | null>(null);
  const [history, setHistory] = useState<OIHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOI = useCallback(async () => {
    if (!slabAddress) return;
    try {
      const data = await api.getOpenInterest(slabAddress);
      setTotalOI(data.totalOpenInterest);
      setHistory(
        (data.history ?? []).map((h) => ({
          timestamp: h.timestamp,
          oi: h.totalOi,
        })),
      );
    } catch {
      // Silently fail — OI display is supplementary
    } finally {
      setLoading(false);
    }
  }, [slabAddress]);

  useEffect(() => {
    if (!slabAddress) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchOI();

    intervalRef.current = setInterval(fetchOI, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [slabAddress, fetchOI]);

  return { totalOI, history, loading };
}
