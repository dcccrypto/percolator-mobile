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
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
  SafeAreaProvider: ({ children }: any) => children,
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
}));

// Mock useMarkets hook
const mockRefetch = jest.fn();
const mockUseMarkets = jest.fn(() => ({
  markets: [
    {
      slabAddress: 'slab1',
      mintAddress: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL-PERP',
      name: 'Solana Perpetual',
      lastPrice: 145.5,
      change24h: 5.2,
      totalOpenInterest: 2500000,
      maxLeverage: 20,
      tradingFeeBps: 5,
      status: 'active',
      logoUrl: null,
      volume24h: 4200000,
      isZombie: false,
      decimals: 6,
      fundingRate: null,
      markPrice: null,
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      slabAddress: 'slab2',
      mintAddress: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
      symbol: 'BTC-PERP',
      name: 'Bitcoin Perpetual',
      lastPrice: 98500,
      change24h: -2.1,
      totalOpenInterest: 5000000,
      maxLeverage: 10,
      tradingFeeBps: 10,
      status: 'active',
      logoUrl: null,
      volume24h: 18500000,
      isZombie: false,
      decimals: 6,
      fundingRate: null,
      markPrice: null,
      createdAt: '2025-06-15T00:00:00Z',
    },
  ],
  loading: false,
  error: null as string | null,
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
    const { getAllByText } = render(<MarketsScreen />);
    // New design: change badge shows "▲ +5.20%" / "▼ -2.10%"
    expect(getAllByText(/▲ \+5\.20%/).length).toBeGreaterThan(0);
    expect(getAllByText(/▼ -2\.10%/).length).toBeGreaterThan(0);
  });

  it('shows open interest in stats row', () => {
    const { getAllByText } = render(<MarketsScreen />);
    // New design: OI label and value in separate Text nodes
    expect(getAllByText('OI').length).toBeGreaterThan(0);
    expect(getAllByText('$2.5M').length).toBeGreaterThan(0);
    expect(getAllByText('$5.0M').length).toBeGreaterThan(0);
  });

  it('renders LONG and SHORT trade buttons per market card', () => {
    const { getAllByText } = render(<MarketsScreen />);
    // New design: uppercase LONG ▲ / SHORT ▼
    expect(getAllByText('LONG ▲')).toHaveLength(2);
    expect(getAllByText('SHORT ▼')).toHaveLength(2);
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

  it('navigates to Trade screen on LONG button press', () => {
    const { getAllByText } = render(<MarketsScreen />);
    const longButtons = getAllByText('LONG ▲');
    fireEvent.press(longButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith(
      'Trade',
      expect.objectContaining({ direction: 'long' }),
    );
  });

  it('navigates to Trade screen on SHORT button press', () => {
    const { getAllByText } = render(<MarketsScreen />);
    const shortButtons = getAllByText('SHORT ▼');
    fireEvent.press(shortButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith(
      'Trade',
      expect.objectContaining({ direction: 'short' }),
    );
  });

  it('Newest filter sorts market with most recent createdAt first', () => {
    // BTC-PERP has createdAt 2025-06-15, SOL-PERP has 2024-01-01
    // After Newest sort, BTC-PERP should appear before SOL-PERP
    const { getAllByText, getByText } = render(<MarketsScreen />);
    fireEvent.press(getByText('Newest'));
    const symbols = getAllByText(/-PERP/);
    // BTC-PERP (newer) should come first
    expect(symbols[0].props.children).toBe('BTC-PERP');
    expect(symbols[1].props.children).toBe('SOL-PERP');
  });

  it('Newest filter places markets with null createdAt at the bottom', () => {
    const nullCreatedAtMarkets = [
      {
        slabAddress: 'slab3',
        symbol: 'ETH-PERP',
        name: 'Ethereum Perpetual',
        lastPrice: 3000,
        change24h: 1.0,
        totalOpenInterest: 1000000,
        maxLeverage: 20,
        tradingFeeBps: 5,
        status: 'active',
        logoUrl: null,
        volume24h: null,
        isZombie: false,
        decimals: 6,
        fundingRate: null,
        markPrice: null,
        mintAddress: '',
        createdAt: '2025-01-01T00:00:00Z',
      },
      {
        slabAddress: 'slab4',
        symbol: 'DOGE-PERP',
        name: 'Doge Perpetual',
        lastPrice: 0.1,
        change24h: 0,
        totalOpenInterest: null,
        maxLeverage: 5,
        tradingFeeBps: 5,
        status: 'active',
        logoUrl: null,
        volume24h: null,
        isZombie: false,
        decimals: 6,
        fundingRate: null,
        markPrice: null,
        mintAddress: '',
        createdAt: null, // null — should sink to bottom
      },
    ];
    mockUseMarkets.mockReturnValue({
      markets: nullCreatedAtMarkets,
      loading: false,
      error: null,
      refetch: mockRefetch,
    });
    const { getAllByText, getByText } = render(<MarketsScreen />);
    fireEvent.press(getByText('Newest'));
    const symbols = getAllByText(/-PERP/);
    expect(symbols[0].props.children).toBe('ETH-PERP');
    expect(symbols[1].props.children).toBe('DOGE-PERP');
    // Reset to default mock for subsequent tests
    mockUseMarkets.mockReset();
  });
});
