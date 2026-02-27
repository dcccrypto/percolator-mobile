/**
 * Tests for src/screens/FaucetScreen.tsx
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

// Mock useMWA
jest.mock('../../src/hooks/useMWA', () => ({
  useMWA: () => ({
    connected: false,
    publicKey: null,
    connect: jest.fn(),
    connecting: false,
  }),
}));

import { FaucetScreen } from '../../src/screens/FaucetScreen';

describe('FaucetScreen', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<FaucetScreen />);
    expect(toJSON()).not.toBeNull();
  });

  it('shows Faucet title', () => {
    const { getAllByText } = render(<FaucetScreen />);
    expect(getAllByText(/Faucet|Devnet/i).length).toBeGreaterThan(0);
  });

  it('shows SOL and USDC token options', () => {
    const { getAllByText } = render(<FaucetScreen />);
    expect(getAllByText('SOL').length).toBeGreaterThan(0);
    expect(getAllByText('USDC').length).toBeGreaterThan(0);
  });

  it('shows a mint/request button', () => {
    const { getAllByText } = render(<FaucetScreen />);
    expect(getAllByText(/Mint|Airdrop|Request/i).length).toBeGreaterThan(0);
  });

  it('shows amount input', () => {
    const { getByDisplayValue } = render(<FaucetScreen />);
    // Default amount for SOL is 1.0
    expect(getByDisplayValue('1.0')).toBeTruthy();
  });
});
