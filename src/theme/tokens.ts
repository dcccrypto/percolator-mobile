/**
 * Design tokens — from designer UX spec (PERC-074).
 * Must match percolatorlaunch.com visual identity.
 */

export const colors = {
  // Backgrounds
  bgVoid: '#06060c',
  bg: '#111118',
  bgElevated: '#1a1a28',
  bgInset: '#0d0d14',

  // Borders
  border: 'rgba(255, 255, 255, 0.06)',
  borderActive: 'rgba(255, 255, 255, 0.12)',

  // Text
  text: '#f0f0f5',
  textSecondary: 'rgba(255, 255, 255, 0.55)',
  textMuted: 'rgba(255, 255, 255, 0.30)',

  // Accent
  accent: '#7c3aed',
  accentLight: '#a78bfa',
  accentSubtle: 'rgba(124, 58, 237, 0.08)',

  // Trading
  long: '#22c55e',
  longSubtle: 'rgba(34, 197, 94, 0.08)',
  short: '#ef4444',
  shortSubtle: 'rgba(239, 68, 68, 0.08)',
  warning: '#eab308',
  warningSubtle: 'rgba(234, 179, 8, 0.08)',

  // Highlights
  cyan: '#22d3ee',
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
