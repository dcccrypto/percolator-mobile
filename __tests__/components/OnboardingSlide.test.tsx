/**
 * Unit tests for src/components/onboarding/OnboardingSlide.tsx
 *
 * Covers:
 *  1. SVG icon path — renders OnboardingIcon when `icon` prop is set
 *  2. PNG fallback path — renders Image (not OnboardingIcon) when `icon` is omitted
 */
import React from 'react';
import { render } from '@testing-library/react-native';

// ── Mocks ──────────────────────────────────────────────────────────────────

// react-native-reanimated — worklet functions need a minimal stub
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  // withTiming is not always present in older mock builds; provide a passthrough
  Reanimated.default.withTiming = (val: number) => val;
  return Reanimated;
});

// react-native-svg — lightweight stubs so SVG renders without native bindings
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const stub = (name: string) => {
    const C = ({ children, testID }: any) => <View testID={testID}>{children}</View>;
    C.displayName = name;
    return C;
  };
  return {
    __esModule: true,
    default: stub('Svg'),
    Svg: stub('Svg'),
    Path: stub('Path'),
    Circle: stub('Circle'),
    Ellipse: stub('Ellipse'),
  };
});

// ── Component under test ───────────────────────────────────────────────────

import { OnboardingSlide, OnboardingSlideData } from '../../src/components/onboarding/OnboardingSlide';

const SCREEN_WIDTH = 390;

// ── Tests ──────────────────────────────────────────────────────────────────

describe('OnboardingSlide', () => {
  describe('SVG icon path (icon prop provided)', () => {
    const ICON_TYPES = ['perps', 'onchain', 'deploy'] as const;

    it.each(ICON_TYPES)(
      'renders without crash for icon="%s"',
      (iconType) => {
        const slide: OnboardingSlideData = {
          index: 1,
          title: 'Test Title',
          subtitle: 'Test subtitle',
          icon: iconType,
        };
        const { getByTestId } = render(
          <OnboardingSlide slide={slide} screenWidth={SCREEN_WIDTH} />,
        );
        // The image-wrap container should always be present
        expect(getByTestId('onboarding-slide-image-1')).toBeTruthy();
      },
    );

    it('does NOT render a React Native Image when icon is set', () => {
      const slide: OnboardingSlideData = {
        index: 1,
        title: 'Permissionless Perps',
        subtitle: 'Trade any asset with leverage',
        icon: 'perps',
      };
      const { UNSAFE_queryAllByType } = render(
        <OnboardingSlide slide={slide} screenWidth={SCREEN_WIDTH} />,
      );
      const { Image } = require('react-native');
      const images = UNSAFE_queryAllByType(Image);
      expect(images).toHaveLength(0);
    });
  });

  describe('PNG fallback path (icon prop omitted)', () => {
    it('renders the React Native Image component when icon is not provided', () => {
      const slide: OnboardingSlideData = {
        index: 1,
        title: 'Permissionless Perps',
        subtitle: 'Trade any asset with leverage',
        // icon intentionally omitted → PNG fallback
      };
      const { UNSAFE_getAllByType } = render(
        <OnboardingSlide slide={slide} screenWidth={SCREEN_WIDTH} />,
      );
      const { Image } = require('react-native');
      const images = UNSAFE_getAllByType(Image);
      expect(images.length).toBeGreaterThanOrEqual(1);
    });

    it('PNG Image receives the correct source for slide index 1', () => {
      const slide: OnboardingSlideData = {
        index: 1,
        title: 'Permissionless Perps',
        subtitle: 'Trade any asset with leverage',
      };
      const { UNSAFE_getAllByType } = render(
        <OnboardingSlide slide={slide} screenWidth={SCREEN_WIDTH} />,
      );
      const { Image } = require('react-native');
      const [img] = UNSAFE_getAllByType(Image);
      // jest's fileMock returns 'test-file-stub' for require()'d assets
      expect(img.props.source).toBe('test-file-stub');
    });

    it('PNG Image receives the correct source for slide index 2', () => {
      const slide: OnboardingSlideData = {
        index: 2,
        title: 'Fully On-Chain',
        subtitle: 'Every trade settles on-chain',
      };
      const { UNSAFE_getAllByType } = render(
        <OnboardingSlide slide={slide} screenWidth={SCREEN_WIDTH} />,
      );
      const { Image } = require('react-native');
      const [img] = UNSAFE_getAllByType(Image);
      expect(img.props.source).toBe('test-file-stub');
    });

    it('PNG Image receives the correct source for slide index 3', () => {
      const slide: OnboardingSlideData = {
        index: 3,
        title: 'Deploy Capital',
        subtitle: 'Put your assets to work',
      };
      const { UNSAFE_getAllByType } = render(
        <OnboardingSlide slide={slide} screenWidth={SCREEN_WIDTH} />,
      );
      const { Image } = require('react-native');
      const [img] = UNSAFE_getAllByType(Image);
      expect(img.props.source).toBe('test-file-stub');
    });

    it('PNG Image uses resizeMode="contain"', () => {
      const slide: OnboardingSlideData = {
        index: 1,
        title: 'Test',
        subtitle: 'Test subtitle',
      };
      const { UNSAFE_getAllByType } = render(
        <OnboardingSlide slide={slide} screenWidth={SCREEN_WIDTH} />,
      );
      const { Image } = require('react-native');
      const [img] = UNSAFE_getAllByType(Image);
      expect(img.props.resizeMode).toBe('contain');
    });

    it('imageWrap container is present for PNG fallback', () => {
      const slide: OnboardingSlideData = {
        index: 2,
        title: 'Fully On-Chain',
        subtitle: 'Every trade settles on-chain',
      };
      const { getByTestId } = render(
        <OnboardingSlide slide={slide} screenWidth={SCREEN_WIDTH} />,
      );
      expect(getByTestId('onboarding-slide-image-2')).toBeTruthy();
    });
  });

  describe('slide text rendering', () => {
    it('renders title and subtitle text', () => {
      const slide: OnboardingSlideData = {
        index: 1,
        title: 'Permissionless Perps',
        subtitle: 'Trade any asset with leverage',
      };
      const { getByText } = render(
        <OnboardingSlide slide={slide} screenWidth={SCREEN_WIDTH} />,
      );
      expect(getByText('Permissionless Perps')).toBeTruthy();
      expect(getByText('Trade any asset with leverage')).toBeTruthy();
    });
  });
});
