/**
 * Tests for src/screens/MarketCreationScreen.tsx
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// Mock safe area
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

// Mock hooks
jest.mock('../../src/hooks/useMWA', () => ({
  useMWA: () => ({
    connected: true,
    publicKey: { toString: () => 'TestPubkey' },
    connect: jest.fn(),
    connecting: false,
  }),
}));

jest.mock('../../src/hooks/useCreateMarket', () => ({
  useCreateMarket: () => ({
    state: { deploying: false, txSig: null, error: null },
    deploy: jest.fn(),
    reset: jest.fn(),
  }),
}));

import { MarketCreationScreen } from '../../src/screens/MarketCreationScreen';

describe('MarketCreationScreen', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<MarketCreationScreen />);
    expect(toJSON()).not.toBeNull();
  });

  it('shows Quick and Manual deploy modes', () => {
    const { getByText } = render(<MarketCreationScreen />);
    expect(getByText(/Quick/i)).toBeTruthy();
    expect(getByText(/Manual|Advanced/i)).toBeTruthy();
  });

  it('shows market name input', () => {
    const { getByText } = render(<MarketCreationScreen />);
    expect(getByText(/Market Name|Name/i)).toBeTruthy();
  });

  it('shows deploy button', () => {
    const { getAllByText } = render(<MarketCreationScreen />);
    expect(getAllByText(/Deploy|Create/i).length).toBeGreaterThanOrEqual(1);
  });
});
