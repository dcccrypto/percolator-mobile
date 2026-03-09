/**
 * Custom SVG tab bar icons — PERC-528 / DESIGN-BRIEF-MOBILE-V2 §2.
 *
 * Each icon has an active (filled, accent) and inactive (outline, textMuted) state.
 * All icons render at 24×24 by default.
 */
import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { colors } from '../../theme/tokens';

interface TabIconProps {
  focused: boolean;
  size?: number;
}

// ─── Markets — flame shape ────────────────────────────────────────────────────
export function MarketsTabIcon({ focused, size = 24 }: TabIconProps) {
  const c = focused ? colors.accent : colors.textMuted;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {focused ? (
        // Filled flame
        <Path
          d="M12 2C12 2 9 6.5 9 9.5C9 9.5 7 8.5 7.5 6.5C5 9 4 11.5 4 14C4 18.4 7.6 22 12 22C16.4 22 20 18.4 20 14C20 10 17 6 12 2ZM12 19C10.3 19 9 17.7 9 16C9 14.4 10 13.2 11.5 12.5C11.5 13.5 12 14.5 13 15C13 13.5 13.8 12.2 15 11.5C15 13.7 14 19 12 19Z"
          fill={c}
        />
      ) : (
        // Outline flame
        <Path
          d="M12 2C12 2 9 6.5 9 9.5C9 9.5 7 8.5 7.5 6.5C5 9 4 11.5 4 14C4 18.4 7.6 22 12 22C16.4 22 20 18.4 20 14C20 10 17 6 12 2Z"
          stroke={c}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
    </Svg>
  );
}

// ─── Trade — 3-bar candlestick chart ─────────────────────────────────────────
export function TradeTabIcon({ focused, size = 24 }: TabIconProps) {
  const c = focused ? colors.accent : colors.textMuted;
  const fill = focused ? c : 'none';
  const stroke = focused ? 'none' : c;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Left candle: wick top, body, wick bottom */}
      <Path d="M6 3 L6 5" stroke={c} strokeWidth={1.5} strokeLinecap="round" />
      <Rect x={4} y={5} width={4} height={7} rx={0.5} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <Path d="M6 12 L6 14" stroke={c} strokeWidth={1.5} strokeLinecap="round" />

      {/* Middle candle: bearish (taller) */}
      <Path d="M12 2 L12 4" stroke={c} strokeWidth={1.5} strokeLinecap="round" />
      <Rect x={10} y={4} width={4} height={10} rx={0.5} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <Path d="M12 14 L12 16" stroke={c} strokeWidth={1.5} strokeLinecap="round" />

      {/* Right candle: bullish */}
      <Path d="M18 6 L18 8" stroke={c} strokeWidth={1.5} strokeLinecap="round" />
      <Rect x={16} y={8} width={4} height={8} rx={0.5} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <Path d="M18 16 L18 18" stroke={c} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Portfolio — stack of two rounded rects ───────────────────────────────────
export function PortfolioTabIcon({ focused, size = 24 }: TabIconProps) {
  const c = focused ? colors.accent : colors.textMuted;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Back card */}
      <Rect
        x={4} y={5} width={16} height={10}
        rx={2}
        fill={focused ? c : 'none'}
        stroke={c}
        strokeWidth={1.5}
        opacity={focused ? 0.4 : 1}
      />
      {/* Front card */}
      <Rect
        x={4} y={9} width={16} height={10}
        rx={2}
        fill={focused ? c : 'none'}
        stroke={c}
        strokeWidth={1.5}
      />
      {/* Accent line on front card */}
      {focused && (
        <Path
          d="M8 13 L13 13"
          stroke={colors.bgVoid}
          strokeWidth={1.5}
          strokeLinecap="round"
          opacity={0.8}
        />
      )}
    </Svg>
  );
}

// ─── More — 3 horizontal dots ─────────────────────────────────────────────────
export function MoreTabIcon({ focused, size = 24 }: TabIconProps) {
  const c = focused ? colors.accent : colors.textMuted;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={6} cy={12} r={focused ? 2.5 : 2} fill={c} />
      <Circle cx={12} cy={12} r={focused ? 2.5 : 2} fill={c} />
      <Circle cx={18} cy={12} r={focused ? 2.5 : 2} fill={c} />
    </Svg>
  );
}
