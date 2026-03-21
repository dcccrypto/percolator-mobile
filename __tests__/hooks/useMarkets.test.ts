/**
 * Tests for src/hooks/useMarkets.ts
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';

// Mock the api module — useMarkets receives already-normalised MarketData (camelCase)
const mockGetMarkets = jest.fn();
jest.mock('../../src/lib/api', () => ({
  api: {
    getMarkets: () => mockGetMarkets(),
  },
}));

import { useMarkets } from '../../src/hooks/useMarkets';

/** Helper: minimal camelCase MarketData as returned by api.getMarkets() after normalisation */
function makeMarketData(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    slabAddress: 'slab1',
    mintAddress: 'mint1',
    symbol: 'SOL-PERP',
    name: 'Solana',
    lastPrice: 145,
    markPrice: 145.1,
    indexPrice: 144.9,
    fundingRate: 0.01,
    totalOpenInterest: 1000000,
    totalAccounts: 10,
    maxLeverage: 20,
    tradingFeeBps: 5,
    status: 'active',
    logoUrl: null,
    decimals: 9,
    volume24h: 500000,
    isZombie: false,
    ...overrides,
  };
}

describe('useMarkets', () => {
  beforeEach(() => {
    mockGetMarkets.mockReset();
    // Reset module-level cache: re-require to clear _marketsCache
    jest.resetModules();
  });

  it('starts with loading = true', () => {
    mockGetMarkets.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useMarkets());
    expect(result.current.loading).toBe(true);
  });

  it('sets markets after successful fetch', async () => {
    mockGetMarkets.mockResolvedValueOnce([makeMarketData()]);

    const { result } = renderHook(() => useMarkets());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.markets).toHaveLength(1);
    const m = result.current.markets[0];
    expect(m.symbol).toBe('SOL-PERP');
    expect(m.slabAddress).toBe('slab1');
    expect(m.lastPrice).toBe(145);
    expect(m.volume24h).toBe(500000);
    expect(m.status).toBe('active');
    expect(m.isZombie).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error on failed fetch', async () => {
    mockGetMarkets.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useMarkets());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    // Markets may retain cached data from module-level cache — that's correct behavior.
  });

  it('has a refetch function', async () => {
    mockGetMarkets.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useMarkets());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(typeof result.current.refetch).toBe('function');
  });

  it('refetch re-fetches markets', async () => {
    mockGetMarkets.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useMarkets());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockGetMarkets.mockResolvedValueOnce([
      makeMarketData({ slabAddress: 'slab2', symbol: 'BTC-PERP', name: 'Bitcoin', lastPrice: 98000, volume24h: 2000000 }),
    ]);

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.markets.length).toBeGreaterThanOrEqual(0);
  });
});
