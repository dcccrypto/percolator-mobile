/**
 * CreateMarketFAB — Floating Action Button to launch the Create Market Wizard.
 *
 * Per designer spec: HACKATHON-MOBILE-UX-SPECS.md §1
 *
 * - 56×56dp violet circle, fixed bottom-right
 * - Rocket emoji icon (24dp)
 * - Label pill auto-hides after 3s on first render
 * - Press: scale(0.92) spring + darker bg
 * - Renders on: MarketsList, TradeScreen, Dashboard
 * - z-index 50 (above content, below modals)
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const VIOLET = '#7C3AED';
const VIOLET_PRESSED = '#6D28D9';
const DISABLED_BG = '#454B5F';
const LABEL_BG = '#1C1F2E';
const TEXT = '#E1E2E8';

interface CreateMarketFABProps {
  disabled?: boolean;
}

export function CreateMarketFAB({ disabled = false }: CreateMarketFABProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  // Label fade animation
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const [labelVisible, setLabelVisible] = useState(false);

  // Scale animation for press feedback
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Show label on first mount, auto-hide after 3s
  useEffect(() => {
    setLabelVisible(true);
    Animated.timing(labelOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    const hide = setTimeout(() => {
      Animated.timing(labelOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setLabelVisible(false));
    }, 3000);

    return () => clearTimeout(hide);
  }, [labelOpacity]);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [disabled, scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    navigation.navigate('CreateMarket');
  }, [disabled, navigation]);

  const fabBottom = 24 + insets.bottom;

  return (
    <View
      style={[styles.container, { bottom: fabBottom }]}
      pointerEvents="box-none"
    >
      {/* Label pill — visible to the left of FAB */}
      {labelVisible && (
        <Animated.View style={[styles.labelPill, { opacity: labelOpacity }]}>
          <Text style={styles.labelText}>Create Market</Text>
        </Animated.View>
      )}

      {/* FAB button */}
      <Animated.View
        style={[
          { transform: [{ scale: scaleAnim }] },
          disabled && styles.fabDisabled,
        ]}
      >
        <TouchableOpacity
          style={[
            styles.fab,
            disabled && styles.fabDisabled,
          ]}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
          disabled={disabled}
          accessibilityLabel="Create Market"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.fabIcon}>🚀</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 50,
    // Elevation for Android
    ...Platform.select({
      android: { elevation: 8 },
    }),
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: VIOLET,
    justifyContent: 'center',
    alignItems: 'center',
    // iOS shadow
    shadowColor: VIOLET,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  fabDisabled: {
    backgroundColor: DISABLED_BG,
    opacity: 0.5,
    shadowOpacity: 0,
  },
  fabIcon: {
    fontSize: 24,
    lineHeight: 28,
  },
  labelPill: {
    backgroundColor: LABEL_BG,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 12,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT,
  },
});
