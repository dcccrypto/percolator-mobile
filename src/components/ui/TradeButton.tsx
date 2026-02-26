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
  const bg = isLong ? colors.long : colors.short;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: bg },
        size === 'sm' && styles.sm,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={[styles.text, size === 'sm' && styles.textSm]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: radii.xl,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
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
    opacity: 0.4,
  },
  text: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  textSm: {
    fontSize: 12,
    fontWeight: '600',
  },
});
