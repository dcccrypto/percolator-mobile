/**
 * Tests for src/screens/OnboardingScreen.tsx
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

// Mock safe area
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

// Mutable MWA state — update per-test before render
const mockMWAState = {
  connect: jest.fn(),
  connecting: false,
  connected: false,
  publicKey: null as any,
  error: null as string | null,
};

jest.mock('../../src/hooks/useMWA', () => ({
  useMWA: () => mockMWAState,
}));

import { OnboardingScreen } from '../../src/screens/OnboardingScreen';

describe('OnboardingScreen', () => {
  const mockOnComplete = jest.fn();

  beforeEach(() => {
    mockMWAState.connect = jest.fn().mockResolvedValue(null);
    mockMWAState.connecting = false;
    mockMWAState.connected = false;
    mockMWAState.publicKey = null;
    mockMWAState.error = null;
    mockOnComplete.mockReset();
  });

  // ── Slide screen ─────────────────────────────────────────────────────────

  it('renders first slide title', () => {
    const { getByText } = render(<OnboardingScreen onComplete={mockOnComplete} />);
    expect(getByText(/Permissionless Perps/)).toBeTruthy();
  });

  it('renders slide subtitle', () => {
    const { getByText } = render(<OnboardingScreen onComplete={mockOnComplete} />);
    expect(getByText(/Trade any asset with leverage/)).toBeTruthy();
  });

  it('renders slide icons', () => {
    const { getByTestId } = render(<OnboardingScreen onComplete={mockOnComplete} />);
    expect(getByTestId('onboarding-slide-image-1')).toBeTruthy();
  });

  // ── CTA progression (section 5.6) ────────────────────────────────────────

  it('first slide shows "Next →" (not "Get Started")', () => {
    const { getByTestId, queryByTestId } = render(
      <OnboardingScreen onComplete={mockOnComplete} />,
    );
    expect(getByTestId('onboarding-next')).toBeTruthy();
    expect(queryByTestId('onboarding-cta')).toBeNull();
  });

  it('pressing "Next →" advances to slide 2', async () => {
    const { getByTestId, getByText } = render(
      <OnboardingScreen onComplete={mockOnComplete} />,
    );
    await act(async () => {
      fireEvent.press(getByTestId('onboarding-next'));
    });
    expect(getByText(/Fully On-Chain/)).toBeTruthy();
  });

  it('last slide shows "Get Started" CTA (not "Next →")', async () => {
    const { getByTestId, queryByTestId } = render(
      <OnboardingScreen onComplete={mockOnComplete} />,
    );
    await act(async () => { fireEvent.press(getByTestId('onboarding-next')); });
    await act(async () => { await new Promise(r => setTimeout(r, 400)); });
    await act(async () => { fireEvent.press(getByTestId('onboarding-next')); });
    await act(async () => { await new Promise(r => setTimeout(r, 400)); });
    expect(getByTestId('onboarding-cta')).toBeTruthy();
    expect(queryByTestId('onboarding-next')).toBeNull();
  });

  it('pressing "Get Started" on last slide navigates to wallet screen', async () => {
    const { getByTestId, getByText } = render(
      <OnboardingScreen onComplete={mockOnComplete} />,
    );
    await openWalletScreen(getByTestId);
    expect(getByText('Connect Your Wallet')).toBeTruthy();
  });

  // ── Wallet screen (navigate to last slide first) ─────────────────────────

  /**
   * Helper: press "Next →" through all intermediate slides, then "Get Started".
   * Waits 400ms between presses to clear the isTransitioning lock (TRANSITION_MS+50=350ms).
   */
  async function openWalletScreen(getByTestId: any) {
    await act(async () => { fireEvent.press(getByTestId('onboarding-next')); });
    await act(async () => { await new Promise(r => setTimeout(r, 400)); });
    await act(async () => { fireEvent.press(getByTestId('onboarding-next')); });
    await act(async () => { await new Promise(r => setTimeout(r, 400)); });
    await act(async () => { fireEvent.press(getByTestId('onboarding-cta')); });
  }

  it('wallet screen shows wallet options', async () => {
    const { getByTestId, getByText } = render(
      <OnboardingScreen onComplete={mockOnComplete} />,
    );
    await openWalletScreen(getByTestId);
    expect(getByText('Seed Vault')).toBeTruthy();
    expect(getByText('Phantom')).toBeTruthy();
    expect(getByText('Solflare')).toBeTruthy();
  });

  it('tapping a wallet calls connect()', async () => {
    const { getByTestId, getByText } = render(
      <OnboardingScreen onComplete={mockOnComplete} />,
    );
    await openWalletScreen(getByTestId);
    await act(async () => {
      fireEvent.press(getByText('Phantom'));
    });
    await waitFor(() => {
      expect(mockMWAState.connect).toHaveBeenCalledTimes(1);
    }, { timeout: 1500 });
  });

  it('calls onComplete() when connect() returns a pubkey', async () => {
    const { PublicKey } = require('@solana/web3.js');
    mockMWAState.connect.mockResolvedValue(
      new PublicKey('DummyPubkeyBase58ForTesting11111111111111111'),
    );

    const { getByTestId, getByText } = render(
      <OnboardingScreen onComplete={mockOnComplete} />,
    );
    await openWalletScreen(getByTestId);
    await act(async () => {
      fireEvent.press(getByText('Phantom'));
    });

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    }, { timeout: 1500 });
  });

  // ── Error banner ──────────────────────────────────────────────────────────

  it('error banner: "No compatible wallet app" rendered when MWA error = WALLET_NOT_FOUND', async () => {
    mockMWAState.error = 'MWA_WALLET_NOT_FOUND';
    const { getByTestId, getByText } = render(
      <OnboardingScreen onComplete={mockOnComplete} />,
    );
    await openWalletScreen(getByTestId);
    await waitFor(() => {
      expect(getByText(/No compatible wallet app found/)).toBeTruthy();
    });
  });

  it('error banner: shows "Install Phantom" button for WALLET_NOT_FOUND', async () => {
    mockMWAState.error = 'WALLET_NOT_FOUND';
    const { getByTestId, getByText } = render(
      <OnboardingScreen onComplete={mockOnComplete} />,
    );
    await openWalletScreen(getByTestId);
    await waitFor(() => {
      expect(getByText('Install Phantom')).toBeTruthy();
    });
  });

  it('error banner: shows cancellation message for CANCELED', async () => {
    mockMWAState.error = 'MWA_CANCELED';
    const { getByTestId, getByText } = render(
      <OnboardingScreen onComplete={mockOnComplete} />,
    );
    await openWalletScreen(getByTestId);
    await waitFor(() => {
      expect(getByText('Wallet connection was cancelled.')).toBeTruthy();
    });
  });

  it('error banner: shows cancellation message for cancelled (lowercase)', async () => {
    mockMWAState.error = 'Request cancelled by user';
    const { getByTestId, getByText } = render(
      <OnboardingScreen onComplete={mockOnComplete} />,
    );
    await openWalletScreen(getByTestId);
    await waitFor(() => {
      expect(getByText('Wallet connection was cancelled.')).toBeTruthy();
    });
  });

  it('error banner: shows generic message for unknown errors (issue #42 — no raw SDK strings)', async () => {
    mockMWAState.error = 'Network timeout';
    const { getByTestId, getByText } = render(
      <OnboardingScreen onComplete={mockOnComplete} />,
    );
    await openWalletScreen(getByTestId);
    await waitFor(() => {
      // Raw SDK error strings are sanitized — generic message shown instead
      expect(getByText('Wallet connection failed. Please try again.')).toBeTruthy();
    });
  });

  it('error banner: does NOT show when error is null', async () => {
    mockMWAState.error = null;
    const { getByTestId, queryByText } = render(
      <OnboardingScreen onComplete={mockOnComplete} />,
    );
    await openWalletScreen(getByTestId);
    expect(queryByText(/No compatible wallet|cancelled|timeout/)).toBeNull();
  });
});
