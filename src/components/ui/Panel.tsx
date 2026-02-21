import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { colors, radii } from '../../theme/tokens';

interface PanelProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Panel({ children, style }: PanelProps) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 16,
  },
});
