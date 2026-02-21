import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { colors } from '../../theme/tokens';

interface HudCornersProps {
  children: React.ReactNode;
  size?: number;
  color?: string;
  opacity?: number;
  style?: ViewStyle;
}

/** HUD corner bracket overlay — matches web app's .hud-corners CSS */
export function HudCorners({
  children,
  size = 12,
  color = colors.accent,
  opacity = 0.6,
  style,
}: HudCornersProps) {
  const cornerBase: ViewStyle = {
    position: 'absolute',
    width: size,
    height: size,
    borderColor: color,
    opacity,
  };

  return (
    <View style={[styles.container, style]}>
      {children}
      <View style={[cornerBase, styles.topLeft]} />
      <View style={[cornerBase, styles.topRight]} />
      <View style={[cornerBase, styles.bottomLeft]} />
      <View style={[cornerBase, styles.bottomRight]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  topLeft: { top: -1, left: -1, borderTopWidth: 1, borderLeftWidth: 1 },
  topRight: { top: -1, right: -1, borderTopWidth: 1, borderRightWidth: 1 },
  bottomLeft: { bottom: -1, left: -1, borderBottomWidth: 1, borderLeftWidth: 1 },
  bottomRight: { bottom: -1, right: -1, borderBottomWidth: 1, borderRightWidth: 1 },
});
