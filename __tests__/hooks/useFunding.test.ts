/**
 * Tests for src/hooks/useFunding.ts
 */
import { renderHook, waitFor } from '@testing-library/react-native';

// Mock api with wrapper functions (avoids jest.mock hoisting issues)
const mockGetFundingDetails = jest.fn();
jest.mock('../../src/lib/api', () => ({
  api: {
    getFundingDetails: (...args: any[]) => mockGetFundingDetails(...args),
  },
}));

import { useFunding } from '../../src/hooks/useFunding';

const MOCK_FUNDING = {
  hourlyRatePercent: 0.01,
  dailyRatePercent: 0.24,
  annualizedPercent: 87.6,
  last24hHistory: [
    { timestamp: '2026-03-09T00:00:00Z', rate: 0.009 },
    { timestamp: '2026-03-09T12:00:00Z', rate: 0.01 },
  ],
};

describe('useFunding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGetFundingDetails.mockResolvedValue(MOCK_FUNDING);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts in loading state', () => {
    mockGetFundingDetails.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useFunding('slab1'));
    expect(result.current.loading).toBe(true);
    expect(result.current.hourlyRate).toBeNull();
  });

  it('returns null values when slabAddress is undefined', async () => {
    const { result } = renderHook(() => useFunding(undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hourlyRate).toBeNull();
    expect(mockGetFundingDetails).not.toHaveBeenCalled();
  });

  it('fetches and returns funding data', async () => {
    const { result } = renderHook(() => useFunding('slab1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hourlyRate).toBe(0.01);
    expect(result.current.dailyRate).toBe(0.24);
    expect(result.current.annualizedRate).toBe(87.6);
    expect(result.current.history).toHaveLength(2);
  });

  it('calls API with the correct slab address', async () => {
    renderHook(() => useFunding('test-slab'));
    await waitFor(() => {});
    expect(mockGetFundingDetails).toHaveBeenCalledWith('test-slab');
  });

  it('sets error on API failure', async () => {
    mockGetFundingDetails.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useFunding('slab1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Network error');
    expect(result.current.hourlyRate).toBeNull();
  });

  it('polls after 30s interval', async () => {
    const { result } = renderHook(() => useFunding('slab1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGetFundingDetails).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(30_000);
    await waitFor(() => {
      expect(mockGetFundingDetails).toHaveBeenCalledTimes(2);
    });
  });

  it('clears interval on unmount', async () => {
    const { result, unmount } = renderHook(() => useFunding('slab1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    unmount();
    jest.advanceTimersByTime(60_000);
    expect(mockGetFundingDetails).toHaveBeenCalledTimes(1);
  });
});
