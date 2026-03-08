import { renderHook, act } from '@testing-library/react-native';
import { usePriceFlash } from '../../src/hooks/usePriceFlash';

describe('usePriceFlash', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns null initially', () => {
    const { result } = renderHook(() => usePriceFlash(100));
    expect(result.current).toBeNull();
  });

  it('returns "up" when price increases', () => {
    const { result, rerender } = renderHook(
      ({ price }) => usePriceFlash(price),
      { initialProps: { price: 100 } },
    );

    rerender({ price: 105 });
    expect(result.current).toBe('up');
  });

  it('returns "down" when price decreases', () => {
    const { result, rerender } = renderHook(
      ({ price }) => usePriceFlash(price),
      { initialProps: { price: 100 } },
    );

    rerender({ price: 95 });
    expect(result.current).toBe('down');
  });

  it('resets to null after duration', () => {
    const { result, rerender } = renderHook(
      ({ price }) => usePriceFlash(price, 300),
      { initialProps: { price: 100 } },
    );

    rerender({ price: 105 });
    expect(result.current).toBe('up');

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBeNull();
  });

  it('ignores null price', () => {
    const { result } = renderHook(() => usePriceFlash(null));
    expect(result.current).toBeNull();
  });

  it('ignores zero price', () => {
    const { result } = renderHook(() => usePriceFlash(0));
    expect(result.current).toBeNull();
  });

  it('no flash on same price', () => {
    const { result, rerender } = renderHook(
      ({ price }) => usePriceFlash(price),
      { initialProps: { price: 100 } },
    );

    rerender({ price: 100 });
    expect(result.current).toBeNull();
  });
});
