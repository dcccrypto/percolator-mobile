/**
 * Tests for src/screens/MarketCreationScreen.tsx (5-step wizard: mint → tier → oracle → review → deploy)
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

// Mock safe area
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

// Mock MWA hook
jest.mock('../../src/hooks/useMWA', () => ({
  useMWA: () => ({
    connected: true,
    publicKey: { toString: () => 'TestPubkey123' },
    connect: jest.fn(),
    connecting: false,
    signAndSend: jest.fn(),
  }),
}));

// Mock new server-assisted useCreateMarket
jest.mock('../../src/hooks/useCreateMarket', () => ({
  useCreateMarket: () => ({
    state: {
      deploying: false,
      step: '',
      stepIndex: 0,
      error: null,
      txSignature: null,
      slabAddress: null,
    },
    deploy: jest.fn(),
    reset: jest.fn(),
  }),
}));

// Mock fetch (used for /api/launch token detection in step 1)
global.fetch = jest.fn(() =>
  Promise.resolve({ ok: false, status: 404 })
) as jest.Mock;

import { MarketCreationScreen } from '../../src/screens/MarketCreationScreen';

describe('MarketCreationScreen', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<MarketCreationScreen />);
    expect(toJSON()).not.toBeNull();
  });

  it('shows step 1: mint address input (market name is on oracle step 3)', () => {
    const { getAllByText } = render(<MarketCreationScreen />);
    // "Create Market" title or "Mint Address" label should exist in step 1
    expect(getAllByText(/Mint Address|Create Market/i).length).toBeGreaterThanOrEqual(1);
    // "Market Name" was moved to the Oracle step (step 3) — not shown in step 1
  });

  it('shows next/advance button in step 1', () => {
    const { getByText } = render(<MarketCreationScreen />);
    // Step 1 CTA advances to tier selection
    expect(getByText(/Next.*Tier|Continue|Next/i)).toBeTruthy();
  });

  it('shows deploy/create button text somewhere in the wizard', () => {
    const { getAllByText } = render(<MarketCreationScreen />);
    // There should be at least one element with Deploy or Create text
    expect(getAllByText(/Deploy|Create/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders title "Create Market"', () => {
    const { getByText } = render(<MarketCreationScreen />);
    expect(getByText(/Create Market/i)).toBeTruthy();
  });
});
