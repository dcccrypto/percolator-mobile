/**
 * Tests for src/screens/TradeScreen.tsx
 */
import React from 'react';
import { render } from '@testing-library/react-native';

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: undefined }),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

// Mock safe area
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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
    connecting: false,
  }),
}));

jest.mock('../../src/hooks/usePriceStream', () => ({
  usePriceStream: () => ({ prices: {}, status: 'disconnected' }),
}));

jest.mock('../../src/hooks/usePriceHistory', () => ({
  usePriceHistory: () => ({
    prices: [100, 101, 102, 103, 104],
    loading: false,
  }),
}));

jest.mock('../../src/hooks/useTrade', () => ({
  useTrade: () => ({
    submitting: false,
    error: null,
    submitTrade: jest.fn(),
  }),
}));

// Mock MiniChart (svg component that doesn't render well in test)
jest.mock('../../src/components/chart/MiniChart', () => ({
  MiniChart: () => null,
}));

import { TradeScreen } from '../../src/screens/TradeScreen';

describe('TradeScreen', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<TradeScreen />);
    expect(toJSON()).not.toBeNull();
  });

  it('shows the default market symbol', () => {
    const { getByText } = render(<TradeScreen />);
    // Defaults to SOL-PERP when no market is selected
    expect(getByText('SOL-PERP')).toBeTruthy();
  });

  it('shows Long and Short direction buttons', () => {
    const { getAllByText } = render(<TradeScreen />);
    expect(getAllByText(/Long/i).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/Short/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows leverage options', () => {
    const { getByText } = render(<TradeScreen />);
    expect(getByText('5x')).toBeTruthy();
  });

  it('shows "Connect Wallet" prompt when not connected', () => {
    const { getByText } = render(<TradeScreen />);
    expect(getByText(/Connect Wallet|Connect your wallet/i)).toBeTruthy();
  });
});
