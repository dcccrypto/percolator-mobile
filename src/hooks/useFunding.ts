import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';

interface FundingHistoryPoint {
  timestamp: string;
  rate: number;
}

interface UseFundingResult {
  hourlyRate: number | null;
  dailyRate: number | null;
  annualizedRate: number | null;
  history: FundingHistoryPoint[];
  loading: boolean;
  error: string | null;
}

const POLL_INTERVAL = 30_000; // 30 seconds

/**
 * Hook to fetch detailed funding rate data with 24h history.
 * Polls every 30 seconds while the slab address is defined.
 */
export function useFunding(slabAddress: string | undefined): UseFundingResult {
  const [hourlyRate, setHourlyRate] = useState<number | null>(null);
  const [dailyRate, setDailyRate] = useState<number | null>(null);
  const [annualizedRate, setAnnualizedRate] = useState<number | null>(null);
  const [history, setHistory] = useState<FundingHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchFunding = useCallback(async () => {
    if (!slabAddress) return;
    try {
      setError(null);
      const data = await api.getFundingDetails(slabAddress);
      setHourlyRate(data.hourlyRatePercent);
      setDailyRate(data.dailyRatePercent);
      setAnnualizedRate(data.annualizedPercent);
      setHistory(data.last24hHistory ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load funding data');
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
    fetchFunding();

    intervalRef.current = setInterval(fetchFunding, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [slabAddress, fetchFunding]);

  return { hourlyRate, dailyRate, annualizedRate, history, loading, error };
}
