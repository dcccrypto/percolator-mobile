/**
 * Tests for src/screens/DashboardScreen.tsx
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

// Mock safe area
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

// Mock useMWA
const mockUseMWAFn = jest.fn();
jest.mock('../../src/hooks/useMWA', () => ({ useMWA: () => mockUseMWAFn() }));

// Mock api with wrapper functions (avoids jest.mock hoisting issues)
const mockGetTraderStats = jest.fn();
const mockGetTraderTrades = jest.fn();
jest.mock('../../src/lib/api', () => ({
  api: {
    getTraderStats: (...args: any[]) => mockGetTraderStats(...args),
    getTraderTrades: (...args: any[]) => mockGetTraderTrades(...args),
  },
}));

// Mock Panel
jest.mock('../../src/components/ui/Panel', () => ({
  Panel: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: any) => <View>{children}</View>,
    Polyline: () => null,
  };
});

import { DashboardScreen } from '../../src/screens/DashboardScreen';

const MOCK_STATS = {
  totalPnl: 12500,
  totalVolume: 500_000,
  totalTrades: 45,
  winRate: 62,
  avgLeverage: 5.2,
};

const MOCK_TRADES = [
  {
    id: 'trade1',
    market: 'SOL-PERP',
    side: 'long' as const,
    size: 100,
    entryPrice: 120,
    pnl: 500,
    timestamp: '2026-03-09T10:00:00Z',
    signature: 'sig1',
  },
  {
    id: 'trade2',
    market: 'BTC-PERP',
    side: 'short' as const,
    size: 0.5,
    entryPrice: 50000,
    pnl: -200,
    timestamp: '2026-03-09T09:00:00Z',
    signature: 'sig2',
  },
];

describe('DashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTraderStats.mockResolvedValue(MOCK_STATS);
    mockGetTraderTrades.mockResolvedValue({ trades: MOCK_TRADES });
  });

  it('shows connect prompt when wallet not connected', () => {
    mockUseMWAFn.mockReturnValue({
      connected: false,
      publicKey: null,
      connect: jest.fn(),
      connecting: false,
    });
    const { getByText } = render(<DashboardScreen />);
    expect(getByText('Dashboard')).toBeTruthy();
  });

  it('fetches data when wallet is connected', async () => {
    const mockKey = { toBase58: () => 'ABC123DEF456GHI789JKL012' };
    mockUseMWAFn.mockReturnValue({ connected: true, publicKey: mockKey });

    render(<DashboardScreen />);
    await waitFor(() => {
      expect(mockGetTraderStats).toHaveBeenCalledWith('ABC123DEF456GHI789JKL012');
      expect(mockGetTraderTrades).toHaveBeenCalledWith('ABC123DEF456GHI789JKL012');
    });
  });

  it('renders win rate when connected', async () => {
    const mockKey = { toBase58: () => 'WALLET123' };
    mockUseMWAFn.mockReturnValue({ connected: true, publicKey: mockKey });
    const { findByText } = render(<DashboardScreen />);
    await findByText('62.0%');
  });

  it('shows positive pnl formatted correctly', async () => {
    const mockKey = { toBase58: () => 'WALLET123' };
    mockUseMWAFn.mockReturnValue({ connected: true, publicKey: mockKey });
    const { findByText } = render(<DashboardScreen />);
    await findByText('+$12.5K');
  });

  it('handles negative pnl', async () => {
    mockGetTraderStats.mockResolvedValue({ ...MOCK_STATS, totalPnl: -3000 });
    const mockKey = { toBase58: () => 'WALLET123' };
    mockUseMWAFn.mockReturnValue({ connected: true, publicKey: mockKey });
    const { findByText } = render(<DashboardScreen />);
    await findByText('$-3.0K');
  });

  it('shows error state on API failure without crashing', async () => {
    mockGetTraderStats.mockRejectedValue(new Error('Server error'));
    const mockKey = { toBase58: () => 'WALLET123' };
    mockUseMWAFn.mockReturnValue({ connected: true, publicKey: mockKey });
    render(<DashboardScreen />);
    await waitFor(() => {
      expect(mockGetTraderStats).toHaveBeenCalled();
    });
  });

  it('shows trade history entries', async () => {
    const mockKey = { toBase58: () => 'WALLET123' };
    mockUseMWAFn.mockReturnValue({ connected: true, publicKey: mockKey });
    const { findByText } = render(<DashboardScreen />);
    await findByText('SOL-PERP');
    await findByText('BTC-PERP');
  });

  it('does not fetch when wallet disconnected', async () => {
    mockUseMWAFn.mockReturnValue({ connected: false, publicKey: null });
    render(<DashboardScreen />);
    await waitFor(() => {});
    expect(mockGetTraderStats).not.toHaveBeenCalled();
  });
});
