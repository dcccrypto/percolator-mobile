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
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');

  // Animated namespace with View passthrough
  const Animated = {
    View: React.forwardRef((props, ref) =>
      React.createElement(View, { ...props, ref }),
    ),
    Text: React.forwardRef((props, ref) =>
      React.createElement(require('react-native').Text, { ...props, ref }),
    ),
    createAnimatedComponent: (Component) =>
      React.forwardRef((props, ref) =>
        React.createElement(Component, { ...props, ref }),
      ),
  };

  const identity = (v) => v;
  const noop = () => {};

  return {
    __esModule: true,
    default: Animated,
    // Hooks
    useSharedValue: (v) => ({ value: v }),
    useAnimatedStyle: (fn) => {
      try { return fn(); } catch (e) {
        console.error('[reanimated mock] useAnimatedStyle callback threw:', e);
        return {};
      }
    },
    useDerivedValue: (fn) => ({ value: fn() }),
    useAnimatedScrollHandler: () => noop,
    useAnimatedGestureHandler: () => ({}),
    // Animations
    withTiming: identity,
    withSpring: identity,
    withDelay: (_delay, anim) => anim,
    withSequence: (...anims) => anims[anims.length - 1],
    withRepeat: (anim) => anim,
    cancelAnimation: noop,
    // Easing — full set used in OnboardingSlide
    Easing: {
      linear: identity,
      ease: identity,
      quad: identity,
      cubic: identity,
      bezier: () => identity,
      circle: identity,
      bounce: identity,
      elastic: () => identity,
      back: () => identity,
      in: (fn) => fn,
      out: (fn) => fn,
      inOut: (fn) => fn,
    },
    // Components
    createAnimatedComponent: (Component) =>
      React.forwardRef((props, ref) =>
        React.createElement(Component, { ...props, ref }),
      ),
    Animated,
    // Misc
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
  };
});

// --------------------------------------------------------------------------
// Wallet store mock (zustand — global wallet state)
// --------------------------------------------------------------------------
const mockWalletStore = {
  connected: false,
  publicKey: null,
  balance: null,
  setConnected: jest.fn((pubkey) => {
    mockWalletStore.connected = true;
    mockWalletStore.publicKey = pubkey;
  }),
  setDisconnected: jest.fn(() => {
    mockWalletStore.connected = false;
    mockWalletStore.publicKey = null;
    mockWalletStore.balance = null;
  }),
  setBalance: jest.fn((bal) => {
    mockWalletStore.balance = bal;
  }),
};
jest.mock('./src/store/walletStore', () => ({
  useWalletStore: jest.fn(() => mockWalletStore),
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
// react-native-safe-area-context mock
// --------------------------------------------------------------------------
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  return {
    SafeAreaProvider: ({ children, ...props }) =>
      React.createElement(View, props, children),
    SafeAreaView: ({ children, ...props }) =>
      React.createElement(View, props, children),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
    initialWindowMetrics: { insets, frame: { x: 0, y: 0, width: 390, height: 844 } },
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
