/**
 * Design tokens — must match percolatorlaunch.com exactly.
 * Source: ~/repo/app/app/globals.css
 */

export const colors = {
  // Backgrounds
  bg: '#0A0A0F',
  bgElevated: '#0F1018',
  bgSurface: '#141820',
  panelBg: '#0D0E15',

  // Borders
  border: '#1C1F2E',
  borderSubtle: '#14161F',
  borderHover: '#2A2E42',

  // Accent (Solana purple)
  accent: '#9945FF',
  accentMuted: '#7B38CC',
  accentSubtle: 'rgba(153,69,255,0.06)',

  // Cyan (Solana green)
  cyan: '#14F195',
  cyanMuted: 'rgba(20,241,149,0.08)',

  // Text
  text: '#E1E2E8',
  textSecondary: '#7A7F96',
  textMuted: '#454B5F',
  textDim: '#2A2E3D',

  // Trading
  long: '#14F195',
  short: '#FF3B5C',
  warning: '#E5A100',

  // HUD accents
  hudLine: 'rgba(153,69,255,0.20)',
  hudLineHover: 'rgba(153,69,255,0.45)',
} as const;

export const timing = {
  fast: 150,
  normal: 300,
  slow: 500,
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
  sm: 2,
  md: 4,
  lg: 8,
  full: 9999,
} as const;

export const fontSizes = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
} as const;
