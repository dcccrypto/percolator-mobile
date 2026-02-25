import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { colors, radii, MIN_TAP_TARGET } from '../../theme/tokens';
import { fonts } from '../../theme/fonts';

interface FilterPillProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

export function FilterPill({ label, active = false, onPress }: FilterPillProps) {
  return (
    <TouchableOpacity
      style={[styles.pill, active && styles.active]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.text, active && styles.activeText]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 32,
    minWidth: MIN_TAP_TARGET,
    paddingHorizontal: 14,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.bgElevated,
    marginRight: 8,
  },
  active: {
    backgroundColor: 'rgba(124, 58, 237, 0.28)',
    borderWidth: 1.5,
    borderColor: 'rgba(124, 58, 237, 0.70)',
    // iOS glow for better visibility on OLED
    ...Platform.select({
      ios: {
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  activeText: {
    color: colors.accentLight,
    fontWeight: '600',
  },
});
