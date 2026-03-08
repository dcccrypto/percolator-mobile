/**
 * Jest setup — mocks for React Native modules and external libraries.
 */

// --------------------------------------------------------------------------
// expo-secure-store mock
// --------------------------------------------------------------------------
const store = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key) => Promise.resolve(store[key] ?? null)),
  setItemAsync: jest.fn((key, value) => {
    store[key] = value;
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key) => {
    delete store[key];
    return Promise.resolve();
  }),
  __reset: () => { Object.keys(store).forEach((k) => delete store[k]); },
}));

// --------------------------------------------------------------------------
// @solana-mobile/mobile-wallet-adapter-protocol mock
// --------------------------------------------------------------------------
jest.mock('@solana-mobile/mobile-wallet-adapter-protocol', () => ({
  // MWA v2 returns addresses as base64-encoded 32-byte public keys
  transact: jest.fn((callback) =>
    callback({
      authorize: jest.fn(() =>
        Promise.resolve({
          accounts: [
            {
              // base64 of 32 zero-bytes (System Program pubkey)
              address: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
              publicKey: new Uint8Array(32),
            },
          ],
          auth_token: 'mock-auth-token',
        }),
      ),
      signAndSendTransactions: jest.fn(() =>
        Promise.resolve({ signatures: [new Uint8Array(64)] }),
      ),
      deauthorize: jest.fn(() => Promise.resolve()),
    }),
  ),
}));

// --------------------------------------------------------------------------
// @solana/web3.js partial mock
// --------------------------------------------------------------------------
jest.mock('@solana/web3.js', () => {
  const actual = jest.requireActual('@solana/web3.js');
  return {
    ...actual,
    Connection: jest.fn().mockImplementation(() => ({
      getAccountInfo: jest.fn(() => Promise.resolve(null)),
      getBalance: jest.fn(() => Promise.resolve(1000000000)),
      getLatestBlockhash: jest.fn(() =>
        Promise.resolve({
          blockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi',
          lastValidBlockHeight: 100,
        }),
      ),
      sendRawTransaction: jest.fn(() =>
        Promise.resolve('5wHu1qwD7q5J2t3i9Z8eLJ3Sma3a4D1b2c6g7h8j9k0m'),
      ),
      confirmTransaction: jest.fn(() =>
        Promise.resolve({ value: { err: null } }),
      ),
      requestAirdrop: jest.fn(() =>
        Promise.resolve('5airdropTxSignature1234567890abcdef'),
      ),
    })),
  };
});

// --------------------------------------------------------------------------
// @supabase/supabase-js mock
// --------------------------------------------------------------------------
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        data: [],
        error: null,
      })),
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    })),
  })),
}));

// --------------------------------------------------------------------------
// react-native-reanimated mock
// --------------------------------------------------------------------------
// react-native-reanimated was removed (not New-Arch compatible + unused).
// Keep a minimal inline mock so any test that imports it doesn't crash.
jest.mock('react-native-reanimated', () => ({
  default: {},
  useSharedValue: (v) => ({ value: v }),
  useAnimatedStyle: (fn) => fn(),
  withTiming: (v) => v,
  withSpring: (v) => v,
  createAnimatedComponent: (c) => c,
  Easing: { linear: (t) => t, ease: (t) => t, bezier: () => (t) => t },
}));

// --------------------------------------------------------------------------
// Silence console.warn in tests
// --------------------------------------------------------------------------
const originalWarn = console.warn;
console.warn = (...args) => {
  // Suppress known noisy warnings in test
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('[Supabase]') || args[0].includes('useNativeDriver'))
  ) {
    return;
  }
  originalWarn(...args);
};

// --------------------------------------------------------------------------
// Global __DEV__ flag (normally set by Metro)
// --------------------------------------------------------------------------
global.__DEV__ = true;

// --------------------------------------------------------------------------
// Expo runtime mock (expo/src/winter requires native modules)
// --------------------------------------------------------------------------
jest.mock('expo-font', () => ({
  loadAsync: jest.fn().mockResolvedValue(undefined),
  isLoaded: jest.fn().mockReturnValue(true),
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

// --------------------------------------------------------------------------
// expo-haptics mock
// --------------------------------------------------------------------------
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// --------------------------------------------------------------------------
// @gorhom/bottom-sheet mock
// --------------------------------------------------------------------------
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  const BottomSheet = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      snapToIndex: jest.fn(),
      close: jest.fn(),
      expand: jest.fn(),
      collapse: jest.fn(),
    }));
    return props.index >= 0 ? React.createElement(View, null, props.children) : null;
  });
  BottomSheet.displayName = 'BottomSheet';
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetView: ({ children }) => React.createElement(View, null, children),
  };
});

// --------------------------------------------------------------------------
// react-native-gesture-handler mock
// --------------------------------------------------------------------------
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GestureHandlerRootView: ({ children, ...props }) =>
      React.createElement(View, props, children),
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    PanGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    LongPressGestureHandler: View,
    NativeViewGestureHandler: View,
    gestureHandlerRootHOC: (comp) => comp,
    Directions: {},
  };
});
