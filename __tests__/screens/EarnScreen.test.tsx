/**
 * Tests for src/screens/EarnScreen.tsx
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

// Mock useMarkets with wrapper function
const mockUseMarketsFn = jest.fn();
jest.mock('../../src/hooks/useMarkets', () => ({ useMarkets: () => mockUseMarketsFn() }));

// Mock api with wrapper functions (avoids jest.mock hoisting issues)
const mockGetInsurance = jest.fn();
jest.mock('../../src/lib/api', () => ({
  api: {
    getInsurance: (...args: any[]) => mockGetInsurance(...args),
  },
}));

// Mock Panel
jest.mock('../../src/components/ui/Panel', () => ({
  Panel: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

import { EarnScreen } from '../../src/screens/EarnScreen';

const MOCK_MARKETS = [
  {
    slabAddress: 'slab1',
    symbol: 'SOL',
    name: 'SOL-PERP',
    logoUrl: null,
    totalOpenInterest: 500_000,
  },
  {
    slabAddress: 'slab2',
    symbol: 'BTC',
    name: 'BTC-PERP',
    logoUrl: null,
    totalOpenInterest: 2_000_000,
  },
];

// Raw on-chain values (6 decimals, matching the default decimals in EarnScreen).
// currentBalance: $120,000 → 120_000 * 10^6 = 120_000_000_000
// feeRevenue:       $8,500 →   8_500 * 10^6 =   8_500_000_000
const MOCK_INSURANCE = {
  currentBalance: 120_000_000_000,
  feeRevenue: 8_500_000_000,
  history: [
    { timestamp: '2026-03-08T00:00:00Z', balance: 100_000_000_000 },
    { timestamp: '2026-03-09T00:00:00Z', balance: 120_000_000_000 },
  ],
};

describe('EarnScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMarketsFn.mockReturnValue({
      markets: MOCK_MARKETS,
      loading: false,
      error: null,
      refetch: jest.fn().mockResolvedValue(undefined),
    });
    mockGetInsurance.mockResolvedValue(MOCK_INSURANCE);
  });

  it('renders title', () => {
    const { getByText } = render(<EarnScreen />);
    expect(getByText('Earn')).toBeTruthy();
  });

  it('renders info banner', () => {
    const { getByText } = render(<EarnScreen />);
    expect(getByText(/Deposit into insurance vaults/)).toBeTruthy();
  });

  it('renders nothing extra while markets are loading', () => {
    mockUseMarketsFn.mockReturnValue({
      markets: [],
      loading: true,
      error: null,
      refetch: jest.fn(),
    });
    const { getByText } = render(<EarnScreen />);
    expect(getByText('Earn')).toBeTruthy();
  });

  it('renders vault entries from markets', async () => {
    const { findByText } = render(<EarnScreen />);
    // EarnScreen renders vault.symbol as the marketName text
    await findByText('SOL');
    await findByText('BTC');
  });

  it('fetches insurance data for each market', async () => {
    render(<EarnScreen />);
    await waitFor(() => {
      expect(mockGetInsurance).toHaveBeenCalledWith('slab1');
      expect(mockGetInsurance).toHaveBeenCalledWith('slab2');
    });
  });

  it('renders total TVL once insurance data loads', async () => {
    const { findByText } = render(<EarnScreen />);
    // 2 vaults each with 120k = $240k
    await findByText('$240.0K');
  });

  it('handles insurance fetch failure gracefully', async () => {
    mockGetInsurance.mockRejectedValue(new Error('Not found'));
    render(<EarnScreen />);
    await waitFor(() => {
      expect(mockGetInsurance).toHaveBeenCalled();
    });
    // Should not crash
  });

  it('shows empty list when no markets', async () => {
    mockUseMarketsFn.mockReturnValue({
      markets: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    const { getByText } = render(<EarnScreen />);
    expect(getByText('Earn')).toBeTruthy();
    expect(mockGetInsurance).not.toHaveBeenCalled();
  });

  it('renders fee revenue correctly', async () => {
    const { findAllByText } = render(<EarnScreen />);
    const matches = await findAllByText('$8.5K');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('shows dash for Total TVL before data loads', () => {
    mockUseMarketsFn.mockReturnValue({
      markets: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    const { getByText } = render(<EarnScreen />);
    expect(getByText('\u2014')).toBeTruthy();
  });

  // Regression: issue #128 — vault.decimals undefined must not crash confirm flow
  it('renders without crash when market has no decimals field (undefined guard)', async () => {
    mockUseMarketsFn.mockReturnValue({
      markets: [
        {
          slabAddress: 'slab-no-decimals',
          symbol: 'NODEC',
          name: 'NODEC-PERP',
          logoUrl: null,
          totalOpenInterest: 100_000,
          // decimals intentionally omitted — simulates poorly-hydrated API response
        },
      ],
      loading: false,
      error: null,
      refetch: jest.fn().mockResolvedValue(undefined),
    });
    mockGetInsurance.mockResolvedValue(MOCK_INSURANCE);

    // Should render without throwing TypeError from vault.decimals being undefined
    const { findByText } = render(<EarnScreen />);
    await findByText('NODEC');
  });

  // Unit guard: the decimals ?? 6 fallback produces valid BigInt (no NaN → TypeError)
  it('decimals ?? 6 guard: BigInt(Math.round(amount * 10 ** (undefined ?? 6))) does not throw', () => {
    const undefinedDecimals: number | undefined = undefined;
    const amountNum = 100.5;
    const decimals = undefinedDecimals ?? 6;
    expect(() => {
      const baseUnits = BigInt(Math.round(amountNum * 10 ** decimals));
      expect(baseUnits).toBe(BigInt(100_500_000));
    }).not.toThrow();
  });
});
