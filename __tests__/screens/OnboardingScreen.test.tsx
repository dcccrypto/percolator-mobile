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
    expect(getByTestId('slide-icon-perps')).toBeTruthy();
  });

  it('has a "Get Started" button', () => {
    const { getByText } = render(<OnboardingScreen onComplete={mockOnComplete} />);
    expect(getByText(/Get Started/i)).toBeTruthy();
  });

  it('pressing "Get Started" navigates to the wallet screen', async () => {
    const { getByText } = render(<OnboardingScreen onComplete={mockOnComplete} />);
    await act(async () => {
      fireEvent.press(getByText(/Get Started/i));
    });
    expect(getByText('Connect Your Wallet')).toBeTruthy();
  });

  // ── Wallet screen ─────────────────────────────────────────────────────────

  it('wallet screen shows wallet options', async () => {
    const { getByText } = render(<OnboardingScreen onComplete={mockOnComplete} />);
    await act(async () => {
      fireEvent.press(getByText(/Get Started/i));
    });
    expect(getByText('Seed Vault')).toBeTruthy();
    expect(getByText('Phantom')).toBeTruthy();
    expect(getByText('Solflare')).toBeTruthy();
  });

  it('tapping a wallet calls connect()', async () => {
    const { getByText } = render(<OnboardingScreen onComplete={mockOnComplete} />);
    await act(async () => {
      fireEvent.press(getByText(/Get Started/i));
    });
    await act(async () => {
      fireEvent.press(getByText('Phantom'));
    });
    expect(mockMWAState.connect).toHaveBeenCalledTimes(1);
  });

  it('calls onComplete() when connect() returns a pubkey', async () => {
    const { PublicKey } = require('@solana/web3.js');
    mockMWAState.connect.mockResolvedValue(
      new PublicKey('DummyPubkeyBase58ForTesting11111111111111111'),
    );

    const { getByText } = render(<OnboardingScreen onComplete={mockOnComplete} />);
    await act(async () => {
      fireEvent.press(getByText(/Get Started/i));
    });
    await act(async () => {
      fireEvent.press(getByText('Phantom'));
    });

    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });

  // ── Error banner ──────────────────────────────────────────────────────────

  it('error banner: shows "No compatible wallet app found" for WALLET_NOT_FOUND', async () => {
    mockMWAState.error = 'MWA_WALLET_NOT_FOUND';

    const { getByText } = render(<OnboardingScreen onComplete={mockOnComplete} />);
    await act(async () => {
      fireEvent.press(getByText(/Get Started/i));
    });

    await waitFor(() => {
      expect(
        getByText(/No compatible wallet app found/),
      ).toBeTruthy();
    });
  });

  it('error banner: shows "Install Phantom" button for WALLET_NOT_FOUND', async () => {
    mockMWAState.error = 'WALLET_NOT_FOUND';

    const { getByText } = render(<OnboardingScreen onComplete={mockOnComplete} />);
    await act(async () => {
      fireEvent.press(getByText(/Get Started/i));
    });

    await waitFor(() => {
      expect(getByText('Install Phantom')).toBeTruthy();
    });
  });

  it('error banner: shows cancellation message for CANCELED', async () => {
    mockMWAState.error = 'MWA_CANCELED';

    const { getByText } = render(<OnboardingScreen onComplete={mockOnComplete} />);
    await act(async () => {
      fireEvent.press(getByText(/Get Started/i));
    });

    await waitFor(() => {
      expect(getByText('Wallet connection was cancelled.')).toBeTruthy();
    });
  });

  it('error banner: shows cancellation message for cancelled (lowercase)', async () => {
    mockMWAState.error = 'Request cancelled by user';

    const { getByText } = render(<OnboardingScreen onComplete={mockOnComplete} />);
    await act(async () => {
      fireEvent.press(getByText(/Get Started/i));
    });

    await waitFor(() => {
      expect(getByText('Wallet connection was cancelled.')).toBeTruthy();
    });
  });

  it('error banner: shows raw error message for unknown errors', async () => {
    mockMWAState.error = 'Network timeout';

    const { getByText } = render(<OnboardingScreen onComplete={mockOnComplete} />);
    await act(async () => {
      fireEvent.press(getByText(/Get Started/i));
    });

    await waitFor(() => {
      expect(getByText('Network timeout')).toBeTruthy();
    });
  });

  it('error banner: does NOT show when error is null', async () => {
    mockMWAState.error = null;

    const { getByText, queryByText } = render(
      <OnboardingScreen onComplete={mockOnComplete} />,
    );
    await act(async () => {
      fireEvent.press(getByText(/Get Started/i));
    });

    expect(queryByText(/No compatible wallet|cancelled|timeout/)).toBeNull();
  });
});
