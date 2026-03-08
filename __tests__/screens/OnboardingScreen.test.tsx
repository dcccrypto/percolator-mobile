/**
 * Tests for src/screens/OnboardingScreen.tsx
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// Mock safe area
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

// Mock useMWA
const mockConnect = jest.fn();
jest.mock('../../src/hooks/useMWA', () => ({
  useMWA: () => ({
    connect: mockConnect,
    connecting: false,
    connected: false,
    publicKey: null,
    error: null,
  }),
}));

import { OnboardingScreen } from '../../src/screens/OnboardingScreen';

describe('OnboardingScreen', () => {
  const mockOnComplete = jest.fn();

  beforeEach(() => {
    mockConnect.mockReset();
    mockOnComplete.mockReset();
  });

  it('renders first slide title', () => {
    const { getByText } = render(
      <OnboardingScreen onComplete={mockOnComplete} />,
    );
    // The first slide should be visible
    expect(getByText(/Permissionless Perps/)).toBeTruthy();
  });

  it('renders slide subtitle', () => {
    const { getByText } = render(
      <OnboardingScreen onComplete={mockOnComplete} />,
    );
    expect(
      getByText(/Trade any asset with leverage/),
    ).toBeTruthy();
  });

  it('renders slide icons', () => {
    const { getByTestId } = render(
      <OnboardingScreen onComplete={mockOnComplete} />,
    );
    // Slide icons are SVG components (OnboardingIcon) since PERC-427 replaced emoji
    expect(getByTestId('slide-icon-perps')).toBeTruthy();
  });

  it('has a "Get Started" button and a Skip button', () => {
    const { getAllByText, getByTestId } = render(
      <OnboardingScreen onComplete={mockOnComplete} />,
    );
    // Skip button is visible from slide 1
    expect(getByTestId('onboarding-skip')).toBeTruthy();
    // Get Started CTA is present
    expect(getByTestId('onboarding-cta')).toBeTruthy();
    // At least one text element matching Get Started|Connect|Skip
    expect(getAllByText(/Get Started|Connect|Skip/i).length).toBeGreaterThanOrEqual(1);
  });
});
