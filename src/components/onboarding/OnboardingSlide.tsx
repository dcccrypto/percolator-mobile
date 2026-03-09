import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { fonts } from '../../theme/fonts';
import { colors } from '../../theme/tokens';

// ---------------------------------------------------------------------------
// Asset map — slide index (1-based) → require()
// ---------------------------------------------------------------------------
const SLIDE_IMAGES: Record<1 | 2 | 3, number> = {
  1: require('../../../assets/onboarding/slide-1-perps.png') as number,
  2: require('../../../assets/onboarding/slide-2-onchain.png') as number,
  3: require('../../../assets/onboarding/slide-3-deploy.png') as number,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type SlideDirection = 'left' | 'right' | 'none';

export interface OnboardingSlideData {
  /** 1-based index that maps directly to the illustration asset */
  index: 1 | 2 | 3;
  title: string;
  subtitle: string;
}

export interface OnboardingSlideProps {
  slide: OnboardingSlideData;
  /**
   * Direction the new slide enters from.
   * - 'right'  → slide enters from the right  (forward navigation)
   * - 'left'   → slide enters from the left   (back navigation)
   * - 'none'   → no translate, only fade-in   (first mount)
   */
  direction?: SlideDirection;
  /** Duration in ms. Default: 280. */
  durationMs?: number;
  /** Image width as a fraction of screen width. Default: 0.68. */
  imageScale?: number;
  /** Screen width in px — caller should pass Dimensions.get('window').width. */
  screenWidth: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * OnboardingSlide
 *
 * Renders a single onboarding illustration + text block with a
 * crossfade + directional slide-in built on react-native-reanimated.
 * Mount a fresh key whenever the active slide changes to trigger the animation.
 *
 * @example
 * ```tsx
 * <OnboardingSlide
 *   key={`${slideIndex}-${animKey}`}
 *   slide={{ index: 1, title: 'Permissionless Perps', subtitle: '...' }}
 *   direction="right"
 *   screenWidth={Dimensions.get('window').width}
 * />
 * ```
 */
export function OnboardingSlide({
  slide,
  direction = 'none',
  durationMs = 280,
  imageScale = 0.68,
  screenWidth,
}: OnboardingSlideProps): React.JSX.Element {
  // Initial values — animate FROM these on mount
  const initialX =
    direction === 'right' ? 44 : direction === 'left' ? -44 : 0;
  const initialOpacity = direction === 'none' ? 1 : 0;

  const translateX = useSharedValue(initialX);
  const opacity = useSharedValue(initialOpacity);

  const easing = Easing.out(Easing.cubic);

  useEffect(() => {
    translateX.value = withTiming(0, { duration: durationMs, easing });
    opacity.value = withTiming(1, { duration: durationMs, easing });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  const imgSize = screenWidth * imageScale;

  return (
    <Animated.View
      style={[styles.slide, animatedStyle]}
      testID={`onboarding-slide-${slide.index}`}
    >
      <View
        style={[styles.imageWrap, { width: imgSize, height: imgSize }]}
        testID={`onboarding-slide-image-${slide.index}`}
      >
        <Image
          source={SLIDE_IMAGES[slide.index]}
          style={{ width: imgSize, height: imgSize }}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.title}>{slide.title}</Text>
      <Text style={styles.subtitle}>{slide.subtitle}</Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  imageWrap: {
    marginBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 30,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
