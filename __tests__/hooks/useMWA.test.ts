/**
 * Tests for src/hooks/useMWA.ts
 */
import { renderHook, act } from '@testing-library/react-native';
import { PublicKey } from '@solana/web3.js';

// The transact mock is set up in jest.setup.js
const mockTransact = require('@solana-mobile/mobile-wallet-adapter-protocol').transact;
const mockSecureStore = require('expo-secure-store');

// Mock error reporting to verify captureException is called with raw errors.
// Note: jest.mock factory is hoisted — cannot reference outer variables here.
jest.mock('../../src/lib/errorReporting', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  initErrorReporting: jest.fn(),
  _setReporterForTest: jest.fn(),
}));

// Retrieve the mock reference AFTER the mock is registered
import * as errorReporting from '../../src/lib/errorReporting';
const mockCaptureException = errorReporting.captureException as jest.MockedFunction<
  typeof errorReporting.captureException
>;

import { useMWA } from '../../src/hooks/useMWA';

describe('useMWA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset secure store
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    mockSecureStore.setItemAsync.mockResolvedValue(undefined);
    mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);
    mockCaptureException.mockReset();
  });

  it('starts disconnected', () => {
    const { result } = renderHook(() => useMWA());
    expect(result.current.connected).toBe(false);
    expect(result.current.publicKey).toBeNull();
    expect(result.current.connecting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('connect() sets connected state with public key', async () => {
    const { result } = renderHook(() => useMWA());

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.publicKey).toBeInstanceOf(PublicKey);
    expect(result.current.connecting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('connect() stores auth token in SecureStore', async () => {
    const { result } = renderHook(() => useMWA());

    await act(async () => {
      await result.current.connect();
    });

    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      'mwa_auth_token',
      expect.any(String)
    );
  });

  it('connect() uses stored auth token for re-authorization', async () => {
    mockSecureStore.getItemAsync.mockResolvedValue('stored-token');
    const { result } = renderHook(() => useMWA());

    await act(async () => {
      await result.current.connect();
    });

    // transact was called, which internally uses the stored token
    expect(mockTransact).toHaveBeenCalled();
    expect(result.current.connected).toBe(true);
  });

  it('connect() handles errors gracefully with sanitized message', async () => {
    mockTransact.mockImplementationOnce(() => {
      throw new Error('User rejected');
    });

    const { result } = renderHook(() => useMWA());

    await act(async () => {
      const pubkey = await result.current.connect();
      expect(pubkey).toBeNull();
    });

    expect(result.current.connected).toBe(false);
    // SDK/third-party error messages are collapsed to a generic string.
    // 'User rejected' is not in USER_CONTROLLED_MESSAGES, so it is sanitized.
    expect(result.current.error).toBe('Failed to connect wallet. Please try again.');
    expect(result.current.connecting).toBe(false);
  });

  it('connect() calls captureException with raw error before sanitizing (issue #44)', async () => {
    const rawError = new Error('MWA_INTERNAL_CRASH: unexpected wallet state');
    mockTransact.mockImplementationOnce(() => {
      throw rawError;
    });

    const { result } = renderHook(() => useMWA());

    await act(async () => {
      await result.current.connect();
    });

    // Raw error captured for Sentry — never shown to user
    expect(mockCaptureException).toHaveBeenCalledWith(rawError, { source: 'useMWA.connect' });
    // UI sees only the generic sanitized message, NOT the raw SDK crash string
    expect(result.current.error).toBe('Failed to connect wallet. Please try again.');
  });

  it('connect() calls captureException for non-Error thrown values', async () => {
    mockTransact.mockImplementationOnce(() => {
      throw 'string error';
    });

    const { result } = renderHook(() => useMWA());

    await act(async () => {
      await result.current.connect();
    });

    expect(mockCaptureException).toHaveBeenCalledWith('string error', { source: 'useMWA.connect' });
    expect(result.current.error).toBe('Failed to connect wallet. Please try again.');
  });

  it('connect() handles non-Error throws', async () => {
    mockTransact.mockImplementationOnce(() => {
      throw 'string error';
    });

    const { result } = renderHook(() => useMWA());

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.error).toBe('Failed to connect wallet. Please try again.');
  });

  it('connect() does NOT call captureException on successful connection', async () => {
    const { result } = renderHook(() => useMWA());

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.connected).toBe(true);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('disconnect() clears state and deletes auth token', async () => {
    const { result } = renderHook(() => useMWA());

    // Connect first
    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.connected).toBe(true);

    // Disconnect
    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.publicKey).toBeNull();
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('mwa_auth_token');
  });

  it('signAndSend() converts Uint8Array to base64 and transacts', async () => {
    const mockSignResult = { signatures: ['sig1'] };
    mockTransact.mockImplementationOnce(async (cb: any) => {
      return cb({
        authorize: jest.fn().mockResolvedValue({ accounts: [{ address: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' }] }),
        signAndSendTransactions: jest.fn().mockResolvedValue(mockSignResult),
      });
    });

    const { result } = renderHook(() => useMWA());

    let sigs: any;
    await act(async () => {
      sigs = await result.current.signAndSend([new Uint8Array([1, 2, 3])]);
    });

    expect(sigs).toEqual(mockSignResult);
  });

  it('connect() sets error when wallet returns null accounts', async () => {
    mockTransact.mockImplementationOnce(async (cb: any) =>
      cb({
        authorize: jest.fn().mockResolvedValue({ accounts: null, auth_token: 'tok' }),
        signAndSendTransactions: jest.fn(),
        deauthorize: jest.fn(),
      }),
    );

    const { result } = renderHook(() => useMWA());

    await act(async () => {
      const pubkey = await result.current.connect();
      expect(pubkey).toBeNull();
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.error).toBe('Wallet returned no accounts. Please try again.');
    expect(result.current.connecting).toBe(false);
  });

  it('connect() sets error when wallet returns empty accounts array', async () => {
    mockTransact.mockImplementationOnce(async (cb: any) =>
      cb({
        authorize: jest.fn().mockResolvedValue({ accounts: [], auth_token: 'tok' }),
        signAndSendTransactions: jest.fn(),
        deauthorize: jest.fn(),
      }),
    );

    const { result } = renderHook(() => useMWA());

    await act(async () => {
      const pubkey = await result.current.connect();
      expect(pubkey).toBeNull();
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.error).toBe('Wallet returned no accounts. Please try again.');
    expect(result.current.connecting).toBe(false);
  });
});
