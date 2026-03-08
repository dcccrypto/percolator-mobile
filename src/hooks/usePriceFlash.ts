/**
 * usePriceFlash — returns an animated color that flashes green/red
 * when the price changes, then fades back to the default color.
 */
import { useRef, useEffect, useState } from 'react';

export type FlashDirection = 'up' | 'down' | null;

/**
 * Tracks price changes and returns the flash direction.
 * Consumers can use this to apply a brief color highlight.
 *
 * @param price - current price value
 * @param durationMs - how long the flash lasts (default 300ms)
 */
export function usePriceFlash(
  price: number | null,
  durationMs = 300,
): FlashDirection {
  const prevPriceRef = useRef<number | null>(null);
  const [flash, setFlash] = useState<FlashDirection>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (price == null || price === 0) return;

    const prev = prevPriceRef.current;
    prevPriceRef.current = price;

    if (prev == null) return; // first value, no flash

    if (price > prev) {
      setFlash('up');
    } else if (price < prev) {
      setFlash('down');
    } else {
      return; // same price, no flash
    }

    // Clear any existing timer
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      setFlash(null);
      timerRef.current = null;
    }, durationMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [price, durationMs]);

  return flash;
}
