/**
 * Tests for src/hooks/useTrades.ts
 */
import { renderHook, waitFor, act } from '@testing-library/react-native';

// Mock api with wrapper functions (avoids jest.mock hoisting issues)
const mockGetTrades = jest.fn();
jest.mock('../../src/lib/api', () => ({
  api: {
    getTrades: (...args: any[]) => mockGetTrades(...args),
  },
}));

import { useTrades } from '../../src/hooks/useTrades';

const MOCK_TRADES = [
  {
    side: 'long' as const,
    size: 10,
    price: 120,
    timestamp: '2026-03-09T12:00:00Z',
    signature: 'sig1',
  },
  {
    side: 'short' as const,
    size: 5,
    price: 50000,
    timestamp: '2026-03-09T11:45:00Z',
    signature: 'sig2',
  },
];

describe('useTrades', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGetTrades.mockResolvedValue(MOCK_TRADES);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts with empty trades when slabAddress is undefined', async () => {
    const { result } = renderHook(() => useTrades(undefined));
    await waitFor(() => {});
    expect(result.current.trades).toHaveLength(0);
    expect(mockGetTrades).not.toHaveBeenCalled();
  });

  it('fetches trades for a given slab', async () => {
    const { result } = renderHook(() => useTrades('slab1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.trades).toHaveLength(2);
    expect(result.current.trades[0].side).toBe('long');
  });

  it('calls API with correct slab address', async () => {
    renderHook(() => useTrades('my-slab'));
    await waitFor(() => {});
    expect(mockGetTrades).toHaveBeenCalledWith('my-slab');
  });

  it('sets error on API failure', async () => {
    mockGetTrades.mockRejectedValue(new Error('Fetch failed'));
    const { result } = renderHook(() => useTrades('slab1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Fetch failed');
    expect(result.current.trades).toHaveLength(0);
  });

  it('exposes refresh function that re-fetches', async () => {
    const { result } = renderHook(() => useTrades('slab1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGetTrades).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.refresh();
    });
    await waitFor(() => {
      expect(mockGetTrades).toHaveBeenCalledTimes(2);
    });
  });

  it('polls at 15 second interval', async () => {
    const { result } = renderHook(() => useTrades('slab1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGetTrades).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(15_000);
    await waitFor(() => {
      expect(mockGetTrades).toHaveBeenCalledTimes(2);
    });
  });

  it('clears polling on unmount', async () => {
    const { result, unmount } = renderHook(() => useTrades('slab1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    unmount();
    jest.advanceTimersByTime(30_000);
    expect(mockGetTrades).toHaveBeenCalledTimes(1);
  });

  it('clears trades when slab becomes undefined', async () => {
    let slab: string | undefined = 'slab1';
    const { result, rerender } = renderHook(() => useTrades(slab));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.trades).toHaveLength(2);

    slab = undefined;
    rerender({});
    await waitFor(() => {
      expect(result.current.trades).toHaveLength(0);
    });
  });
});
