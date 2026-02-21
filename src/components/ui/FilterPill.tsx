import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, radii } from '../../theme/tokens';
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
    height: 32,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.bgElevated,
    marginRight: 8,
  },
  active: {
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  activeText: {
    color: colors.accentLight,
  },
});
