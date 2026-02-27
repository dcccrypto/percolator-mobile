/**
 * Tests for src/hooks/usePriceHistory.ts
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';

// Mock the API
const mockGetPriceHistory = jest.fn();
jest.mock('../../src/lib/api', () => ({
  api: {
    getPriceHistory: (...args: any[]) => mockGetPriceHistory(...args),
  },
}));

import { usePriceHistory, type Timeframe } from '../../src/hooks/usePriceHistory';

describe('usePriceHistory', () => {
  beforeEach(() => {
    mockGetPriceHistory.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns loading=true initially when slab is provided', () => {
    mockGetPriceHistory.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePriceHistory('slab1', '1h'));
    expect(result.current.loading).toBe(true);
  });

  it('returns prices array after fetch', async () => {
    mockGetPriceHistory.mockResolvedValueOnce([
      { slab_address: 'slab1', last_price: 100, mark_price: 101, index_price: 99, updated_at: '2026-01-01' },
      { slab_address: 'slab1', last_price: 105, mark_price: 106, index_price: 104, updated_at: '2026-01-02' },
    ]);

    const { result } = renderHook(() => usePriceHistory('slab1', '1h'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.prices.length).toBeGreaterThan(0);
  });

  it('returns empty prices when slab is undefined', () => {
    const { result } = renderHook(() => usePriceHistory(undefined, '1h'));
    expect(result.current.prices).toEqual([]);
  });

  it('accepts different timeframes', async () => {
    const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1D'];
    for (const tf of timeframes) {
      mockGetPriceHistory.mockResolvedValueOnce([]);
      const { result } = renderHook(() => usePriceHistory('slab1', tf));
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    }
  });
});
