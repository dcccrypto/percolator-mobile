/**
 * Tests for src/screens/StakeScreen.tsx
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

// Mock api with wrapper functions (avoids jest.mock hoisting issues)
const mockGetStakePools = jest.fn();
jest.mock('../../src/lib/api', () => ({
  api: {
    getStakePools: (...args: any[]) => mockGetStakePools(...args),
  },
}));

// Mock Panel
jest.mock('../../src/components/ui/Panel', () => ({
  Panel: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

import { StakeScreen } from '../../src/screens/StakeScreen';

const MOCK_POOLS = [
  {
    id: 'pool-1',
    name: 'SOL-PERP Insurance LP',
    market: 'SOL-PERP',
    tvl: 250_000,
    apr: 12.5,
    capUsed: 180_000,
    capMax: 500_000,
    cooldownSeconds: 86400,
  },
  {
    id: 'pool-2',
    name: 'BTC-PERP Insurance LP',
    market: 'BTC-PERP',
    tvl: 1_200_000,
    apr: 8.3,
    capUsed: 900_000,
    capMax: 2_000_000,
    cooldownSeconds: 172800,
  },
];

describe('StakeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStakePools.mockResolvedValue(MOCK_POOLS);
  });

  it('renders title', () => {
    const { getByText } = render(<StakeScreen />);
    expect(getByText('Stake')).toBeTruthy();
  });

  it('calls getStakePools on mount', () => {
    mockGetStakePools.mockReturnValue(new Promise(() => {}));
    render(<StakeScreen />);
    expect(mockGetStakePools).toHaveBeenCalled();
  });

  it('renders pools after loading', async () => {
    const { findByText } = render(<StakeScreen />);
    await findByText('SOL-PERP Insurance LP');
    await findByText('BTC-PERP Insurance LP');
  });

  it('shows placeholder when API unavailable', async () => {
    mockGetStakePools.mockRejectedValue(new Error('404'));
    const { findByText } = render(<StakeScreen />);
    await findByText('Staking pools coming soon');
  });

  it('renders APR for pools', async () => {
    const { findByText } = render(<StakeScreen />);
    // apr.toFixed(1) => "12.5%" and "8.3%"
    await findByText('12.5%');
    await findByText('8.3%');
  });

  it('renders TVL for pools', async () => {
    const { findByText } = render(<StakeScreen />);
    // formatUsd: 250_000 => "$250.0K", 1_200_000 => "$1.20M"
    await findByText('$250.0K');
    await findByText('$1.20M');
  });

  it('handles retry on placeholder state', async () => {
    mockGetStakePools.mockRejectedValueOnce(new Error('unavailable'));
    mockGetStakePools.mockResolvedValue(MOCK_POOLS);

    const { findByText } = render(<StakeScreen />);
    const retryBtn = await findByText('Retry');

    fireEvent.press(retryBtn);
    await waitFor(() => {
      expect(mockGetStakePools).toHaveBeenCalledTimes(2);
    });
  });

  it('renders info banner text', () => {
    const { getByText } = render(<StakeScreen />);
    expect(getByText(/Stake your insurance LP tokens/)).toBeTruthy();
  });

  it('renders cap utilization percentage', async () => {
    const { findByText } = render(<StakeScreen />);
    // Pool 1: Math.round(180k/500k * 100) = 36 => "36%"
    await findByText('36%');
  });

  it('renders cooldown in days', async () => {
    const { findByText } = render(<StakeScreen />);
    // 86400s = 24h => formatCooldown => "1d 0h"
    await findByText('1d 0h');
  });

  it('shows dash for null APR', async () => {
    mockGetStakePools.mockResolvedValue([{ ...MOCK_POOLS[0], apr: null }]);
    const { findByText } = render(<StakeScreen />);
    await findByText('\u2014');
  });
});
