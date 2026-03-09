/**
 * Tests for src/hooks/useMWA.ts
 *
 * useMWA now delegates connected/publicKey/balance state to the global
 * walletStore (Zustand). The mock walletStore in jest.setup.js is a plain
 * object, so mutations don't trigger React re-renders. We test:
 *   - store methods are called correctly (setConnected, setDisconnected, etc.)
 *   - local state (connecting, error) updates correctly
 *   - captureException behavior
 */
import { renderHook, act } from '@testing-library/react-native';
import { PublicKey } from '@solana/web3.js';

const mockTransact = require('@solana-mobile/mobile-wallet-adapter-protocol').transact;
const mockSecureStore = require('expo-secure-store');
const { useWalletStore } = require('../../src/store/walletStore');

jest.mock('../../src/lib/errorReporting', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  initErrorReporting: jest.fn(),
  _setReporterForTest: jest.fn(),
}));

import * as errorReporting from '../../src/lib/errorReporting';
const mockCaptureException = errorReporting.captureException as jest.MockedFunction<
  typeof errorReporting.captureException
>;

import { useMWA } from '../../src/hooks/useMWA';

function resetWalletStore() {
  const store = useWalletStore();
  store.connected = false;
  store.publicKey = null;
  store.balance = null;
  store.setConnected.mockClear();
  store.setDisconnected.mockClear();
  store.setBalance.mockClear();
}

describe('useMWA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    mockSecureStore.setItemAsync.mockResolvedValue(undefined);
    mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);
    mockCaptureException.mockReset();
    resetWalletStore();
  });

  it('starts disconnected', () => {
    const { result } = renderHook(() => useMWA());
    expect(result.current.connected).toBe(false);
    expect(result.current.publicKey).toBeNull();
    expect(result.current.connecting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('connect() calls setConnected on wallet store with PublicKey', async () => {
    const { result } = renderHook(() => useMWA());

    await act(async () => {
      const pubkey = await result.current.connect();
      expect(pubkey).toBeInstanceOf(PublicKey);
    });

    const store = useWalletStore();
    expect(store.setConnected).toHaveBeenCalledWith(expect.any(PublicKey));
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

    expect(mockTransact).toHaveBeenCalled();
    const store = useWalletStore();
    expect(store.setConnected).toHaveBeenCalled();
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

    expect(result.current.error).toBe('Failed to connect wallet. Please try again.');
    expect(result.current.connecting).toBe(false);
    const store = useWalletStore();
    expect(store.setDisconnected).toHaveBeenCalled();
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

    expect(mockCaptureException).toHaveBeenCalledWith(rawError, { source: 'useMWA.connect' });
    expect(result.current.error).toBe('Failed to connect wallet. Please try again.');
  });

  it('connect() calls captureException for non-Error thrown values and sanitizes UI message', async () => {
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

  it('connect() does NOT call captureException on successful connection', async () => {
    const { result } = renderHook(() => useMWA());

    await act(async () => {
      await result.current.connect();
    });

    const store = useWalletStore();
    expect(store.setConnected).toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('disconnect() calls setDisconnected on wallet store and deletes auth token', async () => {
    const { result } = renderHook(() => useMWA());

    await act(async () => {
      await result.current.disconnect();
    });

    const store = useWalletStore();
    expect(store.setDisconnected).toHaveBeenCalled();
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
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('signAndSend() calls captureException and rethrows on transact failure', async () => {
    const txError = new Error('Transaction rejected by wallet');
    mockTransact.mockImplementationOnce(() => {
      throw txError;
    });

    const { result } = renderHook(() => useMWA());

    await expect(
      act(async () => {
        await result.current.signAndSend([new Uint8Array([1, 2, 3])]);
      }),
    ).rejects.toThrow('Transaction rejected by wallet');

    expect(mockCaptureException).toHaveBeenCalledWith(txError, {
      source: 'useMWA.signAndSend',
      payloadCount: 1,
      hasStoredToken: false,
    });
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

    expect(result.current.error).toBe('Wallet returned no accounts. Please try again.');
    expect(result.current.connecting).toBe(false);
  });
});
