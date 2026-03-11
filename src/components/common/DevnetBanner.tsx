/**
 * DevnetBanner — persistent banner below status bar.
 * Always rendered on all screens to signal devnet mode to users + hackathon judges.
 *
 * Per designer spec: HACKATHON-MOBILE-UX-SPECS.md §3
 * Colors: #1A1200 bg, #E5A100 text/dot (8.34:1 contrast — WCAG AA PASS)
 * Layout: 6×6 dot (marginRight=6) + "DEVNET — not real funds"
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Spec-exact values (designer: HACKATHON-MOBILE-UX-SPECS.md §3)
const BANNER_BG = '#1A1200';
const AMBER = '#E5A100';

export function DevnetBanner() {
  return (
    <View style={styles.banner}>
      <View style={styles.row}>
        <View style={styles.dot} />
        <Text style={styles.label}>DEVNET — not real funds</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 28,
    backgroundColor: BANNER_BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AMBER,
    marginRight: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: AMBER,
    letterSpacing: 0.5,
  },
});
