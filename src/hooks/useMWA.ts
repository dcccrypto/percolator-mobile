import { useState, useCallback } from 'react';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol';
import { PublicKey } from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import { APP_IDENTITY } from '../lib/constants';
import { CLUSTER } from '../lib/solana';
import { captureException } from '../lib/errorReporting';

const AUTH_TOKEN_KEY = 'mwa_auth_token';

interface WalletState {
  connected: boolean;
  publicKey: PublicKey | null;
  connecting: boolean;
  error: string | null;
}

export function useMWA() {
  const [state, setState] = useState<WalletState>({
    connected: false,
    publicKey: null,
    connecting: false,
    error: null,
  });

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, connecting: true, error: null }));
    try {
      const result = await transact(async (wallet) => {
        const storedToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
        const auth = await wallet.authorize({
          cluster: CLUSTER,
          identity: APP_IDENTITY,
          ...(storedToken ? { auth_token: storedToken } : {}),
        });
        // Store auth token for re-authorization
        if (auth.auth_token) {
          await SecureStore.setItemAsync(AUTH_TOKEN_KEY, auth.auth_token);
        }
        return auth;
      });

      if (!result.accounts || result.accounts.length === 0) {
        throw new Error('Wallet returned no accounts. Please try again.');
      }
      // MWA v2 returns address as base64-encoded bytes, not base58
      const addressB64 = result.accounts[0].address;
      const binaryStr = atob(addressB64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const pubkey = new PublicKey(bytes);
      setState({ connected: true, publicKey: pubkey, connecting: false, error: null });
      return pubkey;
    } catch (err) {
      // Capture the raw error for remote monitoring BEFORE sanitizing for the user.
      // The UI layer (OnboardingScreen) shows only sanitized messages — raw strings
      // never reach the user (closes mobile #44, launch #962).
      captureException(err, { source: 'useMWA.connect' });
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      setState({ connected: false, publicKey: null, connecting: false, error: message });
      return null;
    }
  }, []);

  const disconnect = useCallback(async () => {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    setState({ connected: false, publicKey: null, connecting: false, error: null });
  }, []);

  /**
   * Sign and send serialized transactions via MWA.
   * MWA SDK v2 expects `payloads: string[]` (base64-encoded), NOT `transactions: Uint8Array[]`.
   * Returns `{ signatures: string[] }`.
   */
  const signAndSend = useCallback(
    async (serializedTransactions: Uint8Array[]): Promise<{ signatures: string[] }> => {
      const storedToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);

      // Convert Uint8Array[] to base64 strings for MWA v2 API
      const payloads = serializedTransactions.map((tx) => {
        // Use a manual base64 encoder to avoid needing Buffer polyfill
        let binary = '';
        for (let i = 0; i < tx.length; i++) {
          binary += String.fromCharCode(tx[i]);
        }
        return btoa(binary);
      });

      return transact(async (wallet) => {
        await wallet.authorize({
          cluster: CLUSTER,
          identity: APP_IDENTITY,
          ...(storedToken ? { auth_token: storedToken } : {}),
        });
        return wallet.signAndSendTransactions({
          payloads,
        });
      });
    },
    []
  );

  return { ...state, connect, disconnect, signAndSend };
}
