import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { colors } from '../../theme/tokens';

interface PanelProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/** Dark panel matching web app's .panel class */
export function Panel({ children, style }: PanelProps) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.panelBg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 0, // terminal aesthetic — sharp corners
    padding: 16,
  },
});
