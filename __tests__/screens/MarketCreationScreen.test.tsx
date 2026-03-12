/**
 * Tests for src/screens/MarketCreationScreen.tsx
 * 3-step wizard matching web quick mode: Token → Slab Tier → Review
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

// Mock safe area
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

// Mock MWA hook
jest.mock('../../src/hooks/useMWA', () => ({
  useMWA: () => ({
    connected: true,
    publicKey: { toString: () => 'TestPubkey123' },
    connect: jest.fn(),
    connecting: false,
    signAndSend: jest.fn(),
  }),
}));

// Mock useCreateMarket
jest.mock('../../src/hooks/useCreateMarket', () => ({
  useCreateMarket: () => ({
    state: {
      deploying: false,
      step: '',
      stepIndex: 0,
      error: null,
      txSignature: null,
      slabAddress: null,
    },
    deploy: jest.fn(),
    reset: jest.fn(),
  }),
}));

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({ ok: false, status: 404 })
) as jest.Mock;

import { MarketCreationScreen } from '../../src/screens/MarketCreationScreen';

describe('MarketCreationScreen', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<MarketCreationScreen />);
    expect(toJSON()).not.toBeNull();
  });

  it('shows step 1 Token with step indicator', () => {
    const { getByText, getAllByText } = render(<MarketCreationScreen />);
    expect(getByText('Create Market')).toBeTruthy();
    expect(getByText(/Step 1 of 3 — Token/)).toBeTruthy();
    expect(getByText(/STEP 1 \/ 3 — TOKEN/)).toBeTruthy();
  });

  it('shows CONTINUE button in step 1 (matching web)', () => {
    const { getByText } = render(<MarketCreationScreen />);
    expect(getByText('CONTINUE →')).toBeTruthy();
  });

  it('renders title "Create Market"', () => {
    const { getByText } = render(<MarketCreationScreen />);
    expect(getByText('Create Market')).toBeTruthy();
  });

  it('shows TOKEN MINT ADDRESS label (matching web)', () => {
    const { getByText } = render(<MarketCreationScreen />);
    expect(getByText('TOKEN MINT ADDRESS')).toBeTruthy();
  });

  it('step 1 renders CONTINUE button (wizard entry point)', () => {
    // Wizard always starts at Step 1 — "CONTINUE →" is the primary CTA
    const { getByText } = render(<MarketCreationScreen />);
    expect(getByText('CONTINUE →')).toBeTruthy();
  });
});

// GH #111 — market name sanitisation unit tests (no React needed)
describe('marketName symbol sanitisation', () => {
  // Replicate the sanitisation logic from MarketCreationScreen
  function toMarketName(symbol: string): string {
    const cleaned = symbol
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 12)
      .toUpperCase();
    return `${cleaned || 'UNKNOWN'}-PERP`;
  }

  it('clean alphanumeric symbol passes through', () => {
    expect(toMarketName('SOL')).toBe('SOL-PERP');
    expect(toMarketName('WIF')).toBe('WIF-PERP');
    expect(toMarketName('PERCOLATOR')).toBe('PERCOLATOR-PERP');
  });

  it('$ prefix is stripped — GH #111 regression', () => {
    expect(toMarketName('$WIF')).toBe('WIF-PERP');
    expect(toMarketName('$BONK')).toBe('BONK-PERP');
  });

  it('emoji is stripped', () => {
    expect(toMarketName('DOGE🐕')).toBe('DOGE-PERP');
  });

  it('symbol longer than 12 chars is truncated', () => {
    expect(toMarketName('AVERYLONGSYMBOLNAME')).toBe('AVERYLONGSYM-PERP');
  });

  it('empty symbol falls back to UNKNOWN', () => {
    expect(toMarketName('')).toBe('UNKNOWN-PERP');
    expect(toMarketName('$$$')).toBe('UNKNOWN-PERP');
  });

  it('lowercase is uppercased', () => {
    expect(toMarketName('btc')).toBe('BTC-PERP');
  });
});
