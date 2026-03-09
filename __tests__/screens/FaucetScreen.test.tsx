/**
 * Tests for src/screens/FaucetScreen.tsx (redesigned per HACKATHON-MOBILE-UX-SPECS.md §2)
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PublicKey } from '@solana/web3.js';

// Mock safe area
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
}));

// Mock useMWA — configurable per test
const mockRefreshBalance = jest.fn();
const mockUseMWA = jest.fn();
jest.mock('../../src/hooks/useMWA', () => ({
  useMWA: () => mockUseMWA(),
}));

// Mock solana connection
const mockConnection = {
  requestAirdrop: jest.fn().mockResolvedValue('txsig1234567890123456'),
  confirmTransaction: jest.fn().mockResolvedValue({}),
};
jest.mock('../../src/lib/solana', () => ({
  connection: mockConnection,
  CLUSTER: 'devnet',
}));

import { FaucetScreen } from '../../src/screens/FaucetScreen';

describe('FaucetScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMWA.mockReturnValue({
      connected: false,
      publicKey: null,
      balance: null,
      connect: jest.fn(),
      connecting: false,
      refreshBalance: mockRefreshBalance,
    });
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<FaucetScreen />);
    expect(toJSON()).not.toBeNull();
  });

  it('shows Faucet header', () => {
    const { getAllByText } = render(<FaucetScreen />);
    expect(getAllByText(/Faucet/i).length).toBeGreaterThan(0);
  });

  it('shows balance label', () => {
    const { getByText } = render(<FaucetScreen />);
    expect(getByText(/YOUR SOL BALANCE/i)).toBeTruthy();
  });

  it('shows Devnet badge', () => {
    const { getByText } = render(<FaucetScreen />);
    expect(getByText(/Devnet/i)).toBeTruthy();
  });

  it('shows connect hint when wallet not connected', () => {
    const { getByText } = render(<FaucetScreen />);
    expect(getByText(/Connect your wallet/i)).toBeTruthy();
  });

  it('shows MINT TEST TOKENS section', () => {
    const { getByText } = render(<FaucetScreen />);
    expect(getByText(/MINT TEST TOKENS/i)).toBeTruthy();
  });

  it('shows token contract address input label', () => {
    const { getByText } = render(<FaucetScreen />);
    expect(getByText(/Token Contract Address/i)).toBeTruthy();
  });

  describe('with connected wallet', () => {
    const mockPubkey = new PublicKey('11111111111111111111111111111111');

    beforeEach(() => {
      mockUseMWA.mockReturnValue({
        connected: true,
        publicKey: mockPubkey,
        balance: 5.5,
        connect: jest.fn(),
        connecting: false,
        refreshBalance: mockRefreshBalance,
      });
    });

    it('shows SOL balance value', () => {
      const { getByText } = render(<FaucetScreen />);
      expect(getByText(/5\.5/)).toBeTruthy();
    });

    it('shows airdrop button', () => {
      const { getByText } = render(<FaucetScreen />);
      expect(getByText(/AIRDROP/i)).toBeTruthy();
    });

    it('shows MINT TOKENS button', () => {
      const { getByText } = render(<FaucetScreen />);
      expect(getByText(/MINT TOKENS/i)).toBeTruthy();
    });
  });
});
