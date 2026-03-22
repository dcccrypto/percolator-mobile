/**
 * LeverageSlider — DESIGN-BRIEF-MOBILE-V2.md §4.4
 *
 * Continuous slider with snap points at 1× 2× 5× 10× 20×.
 * Uses PanResponder + Animated (zero extra native deps).
 *
 * Track:  bgInset, 4px tall, radii.full
 * Fill:   accent colour → selected position
 * Thumb:  20px circle, accent fill, bgVoid border 2px, elevation 4
 * Ticks:  at 1× 2× 5× 10× 20×, Mono 10px textMuted; active tick = accent
 */
import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  LayoutChangeEvent,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import { colors, radii } from '../../theme/tokens';
import { fonts } from '../../theme/fonts';

export const LEVERAGE_TICKS = [1, 2, 5, 10, 20] as const;
export type LeverageTick = (typeof LEVERAGE_TICKS)[number];

const MIN = 1;
const MAX = 20;
const THUMB_SIZE = 20;
const TRACK_HEIGHT = 4;

function valueToFraction(v: number): number {
  return (Math.max(MIN, Math.min(MAX, v)) - MIN) / (MAX - MIN);
}

function fractionToValue(f: number): number {
  return Math.round(Math.max(0, Math.min(1, f)) * (MAX - MIN) + MIN);
}

/** Snap a raw value to the nearest tick */
function snapToTick(v: number): LeverageTick {
  let best = LEVERAGE_TICKS[0];
  let bestDist = Math.abs(v - best);
  for (const t of LEVERAGE_TICKS) {
    const d = Math.abs(v - t);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best;
}

interface Props {
  value: number;
  onChange: (v: LeverageTick) => void;
  testID?: string;
}

export function LeverageSlider({ value, onChange, testID }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  // Animated fraction (0..1)
  const animFrac = useRef(new Animated.Value(valueToFraction(value))).current;
  const liveValue = useRef(value);
  const liveWidth = useRef(0);

  // Sync external value changes
  const prevValue = useRef(value);
  if (prevValue.current !== value) {
    prevValue.current = value;
    liveValue.current = value;
    animFrac.setValue(valueToFraction(value));
  }

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    liveWidth.current = w;
    setTrackWidth(w);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      // Only claim gesture on explicit horizontal swipe or a tap directly on the slider,
      // so vertical ScrollView scrolls are NOT accidentally intercepted.
      onStartShouldSetPanResponder: (_evt: GestureResponderEvent, gs: PanResponderGestureState) =>
        // Claim only if the touch started with minimal Y movement (i.e. a tap or horizontal drag)
        Math.abs(gs.dy) < 5,
      onMoveShouldSetPanResponder: (_evt: GestureResponderEvent, gs: PanResponderGestureState) =>
        // Claim horizontal move only when dx dominates — prevents scroll theft
        Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,

      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const x = evt.nativeEvent.locationX;
        const f = Math.max(0, Math.min(1, x / (liveWidth.current || 1)));
        const raw = fractionToValue(f);
        liveValue.current = raw;
        animFrac.setValue(f);
        onChange(snapToTick(raw));
      },

      onPanResponderMove: (evt: GestureResponderEvent) => {
        const x = evt.nativeEvent.locationX;
        const f = Math.max(0, Math.min(1, x / (liveWidth.current || 1)));
        const raw = fractionToValue(f);
        animFrac.setValue(f);
        if (raw !== liveValue.current) {
          liveValue.current = raw;
          onChange(snapToTick(raw));
        }
      },

      onPanResponderRelease: () => {
        const snapped = snapToTick(liveValue.current);
        liveValue.current = snapped;
        Animated.timing(animFrac, {
          toValue: valueToFraction(snapped),
          duration: 100,
          useNativeDriver: false,
        }).start();
        onChange(snapped);
      },
    }),
  ).current;

  // Thumb left position = fraction × (trackWidth - THUMB_SIZE), clamped
  const thumbLeft =
    trackWidth > 0
      ? animFrac.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.max(0, trackWidth - THUMB_SIZE)],
          extrapolate: 'clamp',
        })
      : new Animated.Value(0);

  const fillWidth =
    trackWidth > 0
      ? animFrac.interpolate({
          inputRange: [0, 1],
          outputRange: [0, trackWidth],
          extrapolate: 'clamp',
        })
      : new Animated.Value(0);

  return (
    <View testID={testID} style={styles.container}>
      {/* Slider row — track + thumb */}
      <View
        style={styles.hitArea}
        onLayout={onLayout}
        accessibilityRole="adjustable"
        accessibilityLabel="Leverage slider"
        accessibilityValue={{ min: MIN, max: MAX, now: value, text: `${snapToTick(value)}×` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const currentTick = snapToTick(value);
          const idx = LEVERAGE_TICKS.indexOf(currentTick);
          if (event.nativeEvent.actionName === 'increment') {
            if (idx < LEVERAGE_TICKS.length - 1) onChange(LEVERAGE_TICKS[idx + 1]);
          } else if (event.nativeEvent.actionName === 'decrement') {
            if (idx > 0) onChange(LEVERAGE_TICKS[idx - 1]);
          }
        }}
        {...panResponder.panHandlers}
      >
        {/* Track */}
        <View style={styles.track} pointerEvents="none">
          <Animated.View style={[styles.fill, { width: fillWidth }]} />
        </View>

        {/* Thumb */}
        {trackWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.thumb, { left: thumbLeft }]}
          />
        )}
      </View>

      {/* Tick labels — pressable for screen-reader / tap-to-set */}
      <View style={styles.tickRow}>
        {LEVERAGE_TICKS.map((tick) => {
          const frac = valueToFraction(tick);
          const isActive = snapToTick(value) === tick;
          return (
            <Pressable
              key={tick}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`${tick}× leverage`}
              accessibilityState={{ selected: isActive }}
              onPress={() => onChange(tick)}
              style={[styles.tickLabelWrap, { left: `${frac * 100}%` as unknown as number }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.tickText, isActive && styles.tickTextActive]}>
                {tick}×
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 18,
  },
  hitArea: {
    height: 32,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TRACK_HEIGHT,
    backgroundColor: colors.bgInset,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    top: (32 - TRACK_HEIGHT) / 2,
  },
  fill: {
    height: TRACK_HEIGHT,
    backgroundColor: colors.accent,
    borderRadius: radii.full,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.bgVoid,
    top: (32 - THUMB_SIZE) / 2,
    elevation: 4,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  tickRow: {
    position: 'relative',
    height: 16,
    marginTop: 2,
  },
  tickLabelWrap: {
    position: 'absolute',
    transform: [{ translateX: -8 }],
  },
  tickText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    minWidth: 16,
  },
  tickTextActive: {
    color: colors.accent,
  },
});
