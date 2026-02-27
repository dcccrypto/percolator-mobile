/**
 * Tests for App.tsx — root component.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

// Mock safe area
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: any) => children,
  DefaultTheme: {
    dark: false,
    colors: {
      primary: '#000',
      background: '#fff',
      card: '#fff',
      text: '#000',
      border: '#ccc',
      notification: '#f00',
    },
  },
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: undefined }),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }: any) => children,
    Screen: () => null,
  }),
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: any) => children,
    Screen: () => null,
  }),
}));

// Mock all hooks
jest.mock('../src/hooks/useMWA', () => ({
  useMWA: () => ({
    connected: false,
    publicKey: null,
    connect: jest.fn(),
    connecting: false,
    error: null,
  }),
}));

jest.mock('../src/hooks/useMarkets', () => ({
  useMarkets: () => ({
    markets: [],
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

import App from '../App';

describe('App', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<App />);
    expect(toJSON()).not.toBeNull();
  });
});
