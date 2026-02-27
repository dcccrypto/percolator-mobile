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
    const { getByText } = render(
      <OnboardingScreen onComplete={mockOnComplete} />,
    );
    expect(getByText('⚡')).toBeTruthy();
  });

  it('has a "Get Started" or "Connect Wallet" button', () => {
    const { getByText } = render(
      <OnboardingScreen onComplete={mockOnComplete} />,
    );
    // The onboarding should have an action button (either on slides or wallet screen)
    const btn = getByText(/Get Started|Connect|Skip/i);
    expect(btn).toBeTruthy();
  });
});
