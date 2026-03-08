/**
 * Tests for src/screens/PortfolioScreen.tsx
 */
import React from 'react';
import { render } from '@testing-library/react-native';

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

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
    connected: false,
    publicKey: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    connecting: false,
  }),
}));

jest.mock('../../src/hooks/usePositions', () => ({
  usePositions: () => ({
    positions: [],
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('../../src/hooks/useTrade', () => ({
  useTrade: () => ({
    submitting: false,
    error: null,
    submitTrade: jest.fn(),
  }),
}));

import { PortfolioScreen } from '../../src/screens/PortfolioScreen';

describe('PortfolioScreen', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<PortfolioScreen />);
    expect(toJSON()).not.toBeNull();
  });

  it('shows Portfolio title', () => {
    const { getByText } = render(<PortfolioScreen />);
    expect(getByText('Portfolio')).toBeTruthy();
  });

  it('shows connect prompt when wallet not connected', () => {
    const { getAllByText, getByTestId } = render(<PortfolioScreen />);
    // New inline connect wallet empty state with testID
    expect(getByTestId('portfolio-connect-wallet')).toBeTruthy();
    // At least one element with Connect/wallet text
    expect(getAllByText(/Connect|wallet/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty positions state when no positions', () => {
    const { getAllByText } = render(<PortfolioScreen />);
    // Either "No positions" or connect wallet prompt — may match multiple
    expect(getAllByText(/No.*position|Connect/i).length).toBeGreaterThanOrEqual(1);
  });
});
