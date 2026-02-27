/**
 * Design tokens — from designer UX spec (PERC-074).
 * Must match percolatorlaunch.com visual identity.
 */

export const colors = {
  // Backgrounds — synced with web globals.css
  bgVoid: '#06060C',
  bg: '#0A0A0F',
  bgElevated: '#0F1018',
  bgInset: '#141820',
  bgSurface: '#141820',

  // Borders — solid hex to match web (no alpha stacking issues)
  border: '#1C1F2E',
  borderActive: '#2A2E42',
  borderHover: '#2A2E42',

  // Text — solid hex to match web (consistent contrast on all surfaces)
  text: '#E1E2E8',
  textSecondary: '#7A7F96',
  textMuted: '#454B5F',
  textDim: '#2A2E3D',

  // Accent — Solana purple
  accent: '#9945FF',
  accentMuted: '#7B38CC',
  accentSubtle: 'rgba(153, 69, 255, 0.06)',
  accentPillBg: 'rgba(153, 69, 255, 0.18)',

  // Trading — matches web identity
  long: '#14F195',
  longSubtle: 'rgba(20, 241, 149, 0.08)',
  short: '#FF3B5C',
  shortSubtle: 'rgba(255, 59, 92, 0.08)',
  shortBorder: 'rgba(255, 59, 92, 0.3)',
  warning: '#E5A100',
  warningSubtle: 'rgba(229, 161, 0, 0.08)',
  warningBorder: 'rgba(229, 161, 0, 0.2)',

  // Highlights — Solana green (same as --cyan on web).
  // NOTE: cyan and long are intentionally aliased to the same Solana green
  // (#14F195). cyan = UI highlights, long = buy-side trading. Kept as
  // separate semantic tokens so either can diverge independently later.
  cyan: '#14F195',
  cyanMuted: 'rgba(20, 241, 149, 0.08)',

  // Overlays
  bgOverlay: 'rgba(255, 255, 255, 0.06)',
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

export const fontSizes = {
  xs: 11,
  sm: 12,
  caption: 12,
  base: 14,
  body: 16,
  md: 18,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 32,
} as const;

export const timing = {
  fast: 150,
  normal: 200,
  slow: 300,
} as const;

/** Safe areas for Seeker phone */
export const safeAreas = {
  top: 48,
  bottom: 40,
} as const;

/** Minimum touch target (px) */
export const MIN_TAP_TARGET = 48;
