/**
 * Tests for src/screens/SettingsScreen.tsx
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

// Mock useMWA
jest.mock('../../src/hooks/useMWA', () => ({
  useMWA: () => ({
    connected: false,
    publicKey: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    connecting: false,
    error: null,
  }),
}));

import { SettingsScreen } from '../../src/screens/SettingsScreen';

describe('SettingsScreen', () => {
  it('renders the Settings title', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Settings')).toBeTruthy();
  });

  it('renders wallet section', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('WALLET')).toBeTruthy();
  });

  it('shows "Not Connected" when wallet is disconnected', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText(/Not Connected|Connect Wallet/i)).toBeTruthy();
  });

  it('renders trading settings section', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText(/TRADING|Default Leverage/i)).toBeTruthy();
  });

  it('shows default leverage value', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('5x')).toBeTruthy();
  });

  it('renders network section', () => {
    const { getAllByText } = render(<SettingsScreen />);
    // Multiple elements may contain "Network" — just verify at least one exists
    expect(getAllByText(/Network/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows devnet references', () => {
    const { getAllByText } = render(<SettingsScreen />);
    // Multiple elements contain "devnet" (version string, network label, etc.)
    expect(getAllByText(/devnet/i).length).toBeGreaterThanOrEqual(1);
  });
});
