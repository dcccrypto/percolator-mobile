/**
 * DevnetBanner — persistent amber banner below status bar.
 * Always rendered on all screens to signal devnet mode to users + hackathon judges.
 *
 * Per designer spec: HACKATHON-MOBILE-UX-SPECS.md §3
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Custom devnet amber (not in tokens — spec-exact value)
const AMBER = '#E5A100';
const AMBER_BG = '#1A1200';

export function DevnetBanner() {
  return (
    <View style={styles.banner}>
      <View style={styles.dot} />
      <Text style={styles.label}>DEVNET</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 28,
    backgroundColor: AMBER_BG,
    borderBottomWidth: 1,
    borderBottomColor: AMBER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '700',
    color: AMBER,
    letterSpacing: 2.0,
    textTransform: 'uppercase',
  },
});
