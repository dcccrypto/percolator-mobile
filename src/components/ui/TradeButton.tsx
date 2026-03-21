/**
 * TradeButton — spec-compliant CTA for opening long/short positions.
 *
 * Design: DESIGN-BRIEF-MOBILE-V2.md §4.6
 *  - Long: #14F195 bg, bgVoid (#06060C) text — green on dark for contrast
 *  - Short: #FF3B5C bg, white (#FFFFFF) text — red on white for contrast
 *  - Height: 56px (full-width CTA), 44px (sm variant)
 *  - Font: JetBrains Mono Bold 14px
 *  - Border radius: radii.lg (12px)
 *  - Disabled: bgInset bg, textMuted text (no opacity hack)
 */
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii } from '../../theme/tokens';
import { fonts } from '../../theme/fonts';

interface TradeButtonProps {
  label: string;
  direction: 'long' | 'short';
  onPress?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'lg';
  style?: ViewStyle;
}

export function TradeButton({
  label,
  direction,
  onPress,
  disabled = false,
  fullWidth = false,
  size = 'lg',
  style,
}: TradeButtonProps) {
  const isLong = direction === 'long';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isLong ? styles.longBg : styles.shortBg,
        size === 'sm' && styles.sm,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text
        style={[
          styles.text,
          // Long: dark text on green; Short: white text on red; Disabled: muted
          disabled
            ? styles.textDisabled
            : isLong
            ? styles.textLong
            : styles.textShort,
          size === 'sm' && styles.textSm,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  longBg: {
    backgroundColor: colors.long,
  },
  shortBg: {
    backgroundColor: colors.short,
  },
  sm: {
    height: 44,
    borderRadius: radii.md,
    paddingHorizontal: 12,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    backgroundColor: colors.bgInset,
  },
  text: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  textLong: {
    // Dark text on green background — spec §4.6: bgVoid text on Long
    color: colors.bgVoid,
  },
  textShort: {
    // White text on red background
    color: '#FFFFFF',
  },
  textDisabled: {
    color: colors.textMuted,
  },
  textSm: {
    fontSize: 12,
    fontWeight: '600',
  },
});
