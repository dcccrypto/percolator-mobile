/**
 * Tests for src/hooks/useOpenInterest.ts
 */
import { renderHook, waitFor } from '@testing-library/react-native';

// Mock api with wrapper functions (avoids jest.mock hoisting issues)
const mockGetOpenInterest = jest.fn();
jest.mock('../../src/lib/api', () => ({
  api: {
    getOpenInterest: (...args: any[]) => mockGetOpenInterest(...args),
  },
}));

import { useOpenInterest } from '../../src/hooks/useOpenInterest';

const MOCK_OI = {
  totalOpenInterest: 1_500_000,
  history: [
    { timestamp: '2026-03-08T00:00:00Z', totalOi: 1_200_000 },
    { timestamp: '2026-03-09T00:00:00Z', totalOi: 1_500_000 },
  ],
};

describe('useOpenInterest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGetOpenInterest.mockResolvedValue(MOCK_OI);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts in loading state', () => {
    mockGetOpenInterest.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useOpenInterest('slab1'));
    expect(result.current.loading).toBe(true);
  });

  it('returns loading=false and null when slabAddress is undefined', async () => {
    const { result } = renderHook(() => useOpenInterest(undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.totalOI).toBeNull();
    expect(mockGetOpenInterest).not.toHaveBeenCalled();
  });

  it('fetches and returns OI data', async () => {
    const { result } = renderHook(() => useOpenInterest('slab1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.totalOI).toBe(1_500_000);
    expect(result.current.history).toHaveLength(2);
    expect(result.current.history[0]).toEqual({
      timestamp: '2026-03-08T00:00:00Z',
      oi: 1_200_000,
    });
  });

  it('handles API error silently', async () => {
    mockGetOpenInterest.mockRejectedValue(new Error('Server down'));
    const { result } = renderHook(() => useOpenInterest('slab1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.totalOI).toBeNull();
    expect(result.current.history).toHaveLength(0);
  });

  it('polls at 30 second interval', async () => {
    const { result } = renderHook(() => useOpenInterest('slab1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGetOpenInterest).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(30_000);
    await waitFor(() => {
      expect(mockGetOpenInterest).toHaveBeenCalledTimes(2);
    });
  });

  it('clears interval on unmount', async () => {
    const { result, unmount } = renderHook(() => useOpenInterest('slab1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    unmount();
    jest.advanceTimersByTime(60_000);
    expect(mockGetOpenInterest).toHaveBeenCalledTimes(1);
  });

  it('maps history totalOi to oi field', async () => {
    const { result } = renderHook(() => useOpenInterest('slab1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    for (const point of result.current.history) {
      expect(point).toHaveProperty('oi');
      expect(point).not.toHaveProperty('totalOi');
    }
  });
});
