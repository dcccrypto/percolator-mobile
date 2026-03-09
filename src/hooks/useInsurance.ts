import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

interface InsuranceHistoryPoint {
  timestamp: string;
  balance: number;
}

interface UseInsuranceResult {
  balance: number | null;
  feeRevenue: number | null;
  history: InsuranceHistoryPoint[];
  loading: boolean;
}

/**
 * Hook to fetch insurance fund data for a given slab.
 * Fetches once on mount and when slabAddress changes.
 */
export function useInsurance(slabAddress: string | undefined): UseInsuranceResult {
  const [balance, setBalance] = useState<number | null>(null);
  const [feeRevenue, setFeeRevenue] = useState<number | null>(null);
  const [history, setHistory] = useState<InsuranceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInsurance = useCallback(async () => {
    if (!slabAddress) return;
    try {
      const data = await api.getInsurance(slabAddress);
      setBalance(data.currentBalance);
      setFeeRevenue(data.feeRevenue);
      setHistory(data.history ?? []);
    } catch {
      // Silently fail — insurance display is supplementary
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
    fetchInsurance();
  }, [slabAddress, fetchInsurance]);

  return { balance, feeRevenue, history, loading };
}
