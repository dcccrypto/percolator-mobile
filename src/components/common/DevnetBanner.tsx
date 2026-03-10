/**
 * DevnetBanner — persistent amber banner below status bar.
 * Always rendered on all screens to signal devnet mode to users + hackathon judges.
 *
 * Per designer spec: HACKATHON-MOBILE-UX-SPECS.md §3
 * Colors: #92400e bg (dark amber), #fbbf24 text
 * Text: "⚠ DEVNET — not real funds"
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Spec-exact values (designer: HACKATHON-MOBILE-UX-SPECS.md §3)
const AMBER_BG = '#92400e';
const AMBER_TEXT = '#fbbf24';

export function DevnetBanner() {
  return (
    <View style={styles.banner}>
      <Text style={styles.label}>⚠ DEVNET — not real funds</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 28,
    backgroundColor: AMBER_BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: AMBER_TEXT,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
