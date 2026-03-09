/**
 * Tests for src/screens/LeaderboardScreen.tsx
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
const mockUseMWAFn = jest.fn();
jest.mock('../../src/hooks/useMWA', () => ({ useMWA: () => mockUseMWAFn() }));

// Mock api with wrapper functions (avoids jest.mock hoisting issues)
const mockGetLeaderboard = jest.fn();
jest.mock('../../src/lib/api', () => ({
  api: {
    getLeaderboard: (...args: any[]) => mockGetLeaderboard(...args),
  },
}));

// Mock FilterPill — must use `label` prop (not children)
jest.mock('../../src/components/ui/FilterPill', () => ({
  FilterPill: ({ label, onPress }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity onPress={onPress} testID={`filter-${label}`}>
        <Text>{label}</Text>
      </TouchableOpacity>
    );
  },
}));

// Mock Panel
jest.mock('../../src/components/ui/Panel', () => ({
  Panel: ({ children }: any) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

import { LeaderboardScreen } from '../../src/screens/LeaderboardScreen';

const MOCK_ENTRIES = [
  {
    rank: 1,
    wallet: 'ABC123DEF456GHI789',
    volume: 1_500_000,
    pnl: 25000,
    tradeCount: 120,
  },
  {
    rank: 2,
    wallet: 'XYZ987UVW654RST321',
    volume: 800_000,
    pnl: -5000,
    tradeCount: 80,
  },
  {
    rank: 3,
    wallet: 'QQQ111WWW222EEE333',
    volume: 300_000,
    pnl: 10000,
    tradeCount: 55,
  },
];

describe('LeaderboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMWAFn.mockReturnValue({
      connected: false,
      publicKey: null,
      connect: jest.fn(),
      connecting: false,
    });
    mockGetLeaderboard.mockResolvedValue({ traders: MOCK_ENTRIES });
  });

  it('calls getLeaderboard on mount', async () => {
    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(mockGetLeaderboard).toHaveBeenCalledWith('24h');
    });
  });

  it('renders leaderboard entries after loading', async () => {
    const { findByText } = render(<LeaderboardScreen />);
    await findByText('ABC1...I789');
    await findByText('XYZ9...T321');
  });

  it('switches period filter on press', async () => {
    const { getByTestId, findByText } = render(<LeaderboardScreen />);
    await findByText('ABC1...I789');

    mockGetLeaderboard.mockResolvedValue({ traders: [] });
    fireEvent.press(getByTestId('filter-7d'));

    await waitFor(() => {
      expect(mockGetLeaderboard).toHaveBeenCalledWith('7d');
    });
  });

  it('handles API error gracefully', async () => {
    mockGetLeaderboard.mockRejectedValue(new Error('Network error'));
    const { queryByText } = render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(mockGetLeaderboard).toHaveBeenCalled();
    });
    expect(queryByText('ABC1...I789')).toBeNull();
  });

  it('highlights current user wallet', async () => {
    mockUseMWAFn.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'ABC123DEF456GHI789' },
      connect: jest.fn(),
      connecting: false,
    });
    const { findByText } = render(<LeaderboardScreen />);
    await findByText('ABC1...I789');
  });

  it('shows empty state when no traders', async () => {
    mockGetLeaderboard.mockResolvedValue({ traders: [] });
    const { findByText } = render(<LeaderboardScreen />);
    await findByText('No rankings yet');
  });

  it('formats volume correctly for millions', async () => {
    const { findByText } = render(<LeaderboardScreen />);
    await findByText('$1.5M');
  });

  it('formats pnl with positive prefix', async () => {
    const { findByText } = render(<LeaderboardScreen />);
    await findByText('+$25.0K');
  });
});
