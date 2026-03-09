/**
 * Safe number formatting utilities.
 * All functions handle null, undefined, NaN, and Infinity gracefully
 * to prevent silent crashes in render paths.
 */

/** Format a number with fixed decimals, returning '—' for invalid values */
export function safeFixed(value: number | null | undefined, decimals = 2, fallback = '—'): string {
  if (value == null || !Number.isFinite(value)) return fallback;
  return value.toFixed(decimals);
}

/** Format a USD price, handling null/NaN gracefully */
export function formatUsd(value: number | null | undefined, fallback = '$—'): string {
  if (value == null || !Number.isFinite(value)) return fallback;
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

/** Format a price with appropriate decimal precision */
export function formatPrice(price: number | null | undefined, fallback = '$—.—'): string {
  if (price == null || !Number.isFinite(price)) return fallback;
  if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toPrecision(4)}`;
}

/** Format a percentage, handling null/NaN */
export function formatPct(value: number | null | undefined, decimals = 2, fallback = '—'): string {
  if (value == null || !Number.isFinite(value)) return fallback;
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(decimals)}%`;
}

/** Format PnL with color-appropriate prefix */
export function formatPnl(value: number | null | undefined, fallback = '$—'): string {
  if (value == null || !Number.isFinite(value)) return fallback;
  const prefix = value >= 0 ? '+$' : '-$';
  const abs = Math.abs(value);
  if (abs >= 1_000) return `${prefix}${(abs / 1_000).toFixed(1)}K`;
  return `${prefix}${abs.toFixed(2)}`;
}
