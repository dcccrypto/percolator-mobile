/**
 * Tests for src/screens/MarketsScreen.tsx
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

// Mock safe area
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
  SafeAreaProvider: ({ children }: any) => children,
}));

// Mock useMarkets hook
const mockRefetch = jest.fn();
const mockUseMarkets = jest.fn(() => ({
  markets: [
    {
      slabAddress: 'slab1',
      symbol: 'SOL-PERP',
      name: 'Solana Perpetual',
      lastPrice: 145.5,
      change24h: 5.2,
      totalOpenInterest: 2500000,
      maxLeverage: 20,
      tradingFeeBps: 5,
      status: 'active',
    },
    {
      slabAddress: 'slab2',
      symbol: 'BTC-PERP',
      name: 'Bitcoin Perpetual',
      lastPrice: 98500,
      change24h: -2.1,
      totalOpenInterest: 5000000,
      maxLeverage: 10,
      tradingFeeBps: 10,
      status: 'active',
    },
  ],
  loading: false,
  error: null,
  refetch: mockRefetch,
}));

jest.mock('../../src/hooks/useMarkets', () => ({
  useMarkets: () => mockUseMarkets(),
}));

import { MarketsScreen } from '../../src/screens/MarketsScreen';

describe('MarketsScreen', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockRefetch.mockReset();
    mockUseMarkets.mockClear();
  });

  it('renders the Markets title', () => {
    const { getByText } = render(<MarketsScreen />);
    expect(getByText('Markets')).toBeTruthy();
  });

  it('renders market cards', () => {
    const { getByText } = render(<MarketsScreen />);
    expect(getByText('SOL-PERP')).toBeTruthy();
    expect(getByText('BTC-PERP')).toBeTruthy();
  });

  it('shows market prices', () => {
    const { getByText } = render(<MarketsScreen />);
    expect(getByText('$145.50')).toBeTruthy();
    expect(getByText('$98,500')).toBeTruthy();
  });

  it('shows 24h change with correct sign', () => {
    const { getByText } = render(<MarketsScreen />);
    expect(getByText('+5.2%')).toBeTruthy();
    expect(getByText('-2.1%')).toBeTruthy();
  });

  it('shows open interest', () => {
    const { getByText } = render(<MarketsScreen />);
    expect(getByText('OI: $2.5M')).toBeTruthy();
    expect(getByText('OI: $5.0M')).toBeTruthy();
  });

  it('shows max leverage', () => {
    const { getByText } = render(<MarketsScreen />);
    expect(getByText('20x max')).toBeTruthy();
    expect(getByText('10x max')).toBeTruthy();
  });

  it('renders Long and Short trade buttons per market card', () => {
    const { getAllByText } = render(<MarketsScreen />);
    expect(getAllByText('Long ▲')).toHaveLength(2);
    expect(getAllByText('Short ▼')).toHaveLength(2);
  });

  it('renders filter pills', () => {
    const { getByText } = render(<MarketsScreen />);
    expect(getByText('Hot 🔥')).toBeTruthy();
    expect(getByText('Newest')).toBeTruthy();
    expect(getByText('Volume ↓')).toBeTruthy();
  });

  it('renders search input', () => {
    const { getByPlaceholderText } = render(<MarketsScreen />);
    expect(getByPlaceholderText('Search markets...')).toBeTruthy();
  });

  it('filters markets by search text', () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <MarketsScreen />,
    );
    fireEvent.changeText(getByPlaceholderText('Search markets...'), 'SOL');
    expect(getByText('SOL-PERP')).toBeTruthy();
    expect(queryByText('BTC-PERP')).toBeNull();
  });

  it('shows empty state when search finds nothing', () => {
    const { getByPlaceholderText, getByText } = render(
      <MarketsScreen />,
    );
    fireEvent.changeText(getByPlaceholderText('Search markets...'), 'DOGE');
    expect(getByText('No markets matching "DOGE"')).toBeTruthy();
  });

  it('shows loading skeletons when loading', () => {
    mockUseMarkets.mockReturnValueOnce({
      markets: [],
      loading: true,
      error: null,
      refetch: mockRefetch,
    });

    const { toJSON } = render(<MarketsScreen />);
    expect(toJSON()).not.toBeNull();
  });

  it('shows error banner when there is an error', () => {
    mockUseMarkets.mockReturnValueOnce({
      markets: [],
      loading: false,
      error: 'Failed to fetch markets',
      refetch: mockRefetch,
    });

    const { getByText } = render(<MarketsScreen />);
    expect(getByText('⚠ Failed to fetch markets')).toBeTruthy();
    expect(getByText('Retry')).toBeTruthy();
  });

  it('navigates to Trade screen on Long button press', () => {
    const { getAllByText } = render(<MarketsScreen />);
    const longButtons = getAllByText('Long ▲');
    fireEvent.press(longButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith(
      'Trade',
      expect.objectContaining({ direction: 'long' }),
    );
  });

  it('navigates to Trade screen on Short button press', () => {
    const { getAllByText } = render(<MarketsScreen />);
    const shortButtons = getAllByText('Short ▼');
    fireEvent.press(shortButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith(
      'Trade',
      expect.objectContaining({ direction: 'short' }),
    );
  });
});
