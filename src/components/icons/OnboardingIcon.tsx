import React from 'react';
import Svg, { Path, Circle, Ellipse } from 'react-native-svg';
import { colors } from '../../theme/tokens';

type IconType = 'perps' | 'onchain' | 'deploy';

interface OnboardingIconProps {
  type: IconType;
  size?: number;
}

export function OnboardingIcon({ type, size = 72 }: OnboardingIconProps) {
  if (type === 'perps') {
    return (
      <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <Circle cx="32" cy="32" r="24" stroke={colors.cyan}
          strokeWidth={1.5} strokeDasharray="40 30"
          strokeLinecap="round" opacity={0.4} />
        <Circle cx="32" cy="32" r="18" fill={colors.cyan} opacity={0.06} />
        <Path d="M36 8 L22 34 H31 L28 56 L46 28 H36 L40 8 Z"
          fill={colors.cyan} opacity={0.9} />
        <Path d="M36 14 L27 32 H33 L30 46 L41 30 H35 L38 14 Z"
          fill={colors.accent} opacity={0.6} />
      </Svg>
    );
  }

  if (type === 'onchain') {
    return (
      <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <Ellipse cx="32" cy="32" rx="22" ry="16" fill={colors.accent} opacity={0.05} />
        <Path d="M12 32 L20 18 L36 18 L44 32 L36 46 L20 46 Z"
          stroke={colors.accent} strokeWidth={1.5}
          fill="rgba(124,58,237,0.08)" strokeLinejoin="round" />
        <Path d="M28 32 L36 18 L52 18 L60 32 L52 46 L36 46 Z"
          stroke={colors.cyan} strokeWidth={1.5}
          fill="rgba(34,211,238,0.08)" strokeLinejoin="round" />
        <Path d="M36 22 L40 32 L36 42" stroke={colors.cyan}
          strokeWidth={2} strokeLinecap="round" opacity={0.7} />
        <Path d="M28 22 L24 32 L28 42" stroke={colors.accent}
          strokeWidth={2} strokeLinecap="round" opacity={0.7} />
      </Svg>
    );
  }

  // deploy
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Ellipse cx="32" cy="48" rx="6" ry="10" fill={colors.accent} opacity={0.2} />
      <Path d="M28 46 Q32 54 36 46" stroke={colors.accent}
        strokeWidth={2} strokeLinecap="round" opacity={0.6} />
      <Path d="M30 48 Q32 58 34 48" stroke={colors.cyan}
        strokeWidth={1.5} strokeLinecap="round" opacity={0.4} />
      <Path d="M32 8 C32 8 22 22 22 36 L32 40 L42 36 C42 22 32 8 32 8 Z"
        fill={colors.cyan} opacity={0.9} />
      <Circle cx="32" cy="28" r="5" fill="#06060c" opacity={0.8} />
      <Circle cx="32" cy="28" r="3" fill={colors.accent} opacity={0.9} />
      <Circle cx="30.5" cy="26.5" r="1" fill="white" opacity={0.5} />
      <Path d="M22 36 L16 44 L24 40 Z" fill={colors.accent} opacity={0.7} />
      <Path d="M42 36 L48 44 L40 40 Z" fill={colors.accent} opacity={0.7} />
    </Svg>
  );
}
