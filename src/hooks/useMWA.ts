import { useState, useCallback } from 'react';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol';
import { PublicKey } from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import { APP_IDENTITY } from '../lib/constants';
import { CLUSTER, connection } from '../lib/solana';
import { captureException } from '../lib/errorReporting';
import { useWalletStore } from '../store/walletStore';

const AUTH_TOKEN_KEY = 'mwa_auth_token';

export function useMWA() {
  const wallet = useWalletStore();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const result = await transact(async (mwaWallet) => {
        const storedToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
        const auth = await mwaWallet.authorize({
          cluster: CLUSTER,
          identity: APP_IDENTITY,
          ...(storedToken ? { auth_token: storedToken } : {}),
        });
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

      // Update global store
      wallet.setConnected(pubkey);
      setConnecting(false);

      // Fetch SOL balance async
      connection.getBalance(pubkey).then((lamports) => {
        wallet.setBalance(lamports / 1e9);
      }).catch(() => {});

      return pubkey;
    } catch (err) {
      captureException(err, { source: 'useMWA.connect' });

      const USER_CONTROLLED_MESSAGES = new Set([
        'Wallet returned no accounts. Please try again.',
      ]);
      const rawMessage = err instanceof Error ? err.message : '';
      const message = USER_CONTROLLED_MESSAGES.has(rawMessage)
        ? rawMessage
        : 'Failed to connect wallet. Please try again.';

      setConnecting(false);
      setError(message);
      wallet.setDisconnected();
      return null;
    }
  }, [wallet]);

  const disconnect = useCallback(async () => {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    wallet.setDisconnected();
    setError(null);
  }, [wallet]);

  const refreshBalance = useCallback(async () => {
    if (!wallet.publicKey) return;
    try {
      const lamports = await connection.getBalance(wallet.publicKey);
      wallet.setBalance(lamports / 1e9);
    } catch {}
  }, [wallet]);

  /**
   * Sign and send serialized transactions via MWA.
   * MWA SDK v2 expects `payloads: string[]` (base64-encoded), NOT `transactions: Uint8Array[]`.
   * Returns `{ signatures: string[] }`.
   */
  const signAndSend = useCallback(
    async (serializedTransactions: Uint8Array[]): Promise<{ signatures: string[] }> => {
      const storedToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);

      const payloads = serializedTransactions.map((tx) => {
        let binary = '';
        for (let i = 0; i < tx.length; i++) {
          binary += String.fromCharCode(tx[i]);
        }
        return btoa(binary);
      });

      try {
        return await transact(async (mwaWallet) => {
          await mwaWallet.authorize({
            cluster: CLUSTER,
            identity: APP_IDENTITY,
            ...(storedToken ? { auth_token: storedToken } : {}),
          });
          return mwaWallet.signAndSendTransactions({
            payloads,
          });
        });
      } catch (err) {
        captureException(err, {
          source: 'useMWA.signAndSend',
          payloadCount: payloads.length,
          hasStoredToken: Boolean(storedToken),
        });
        throw err;
      }
    },
    []
  );

  return {
    connected: wallet.connected,
    publicKey: wallet.publicKey,
    balance: wallet.balance,
    connecting,
    error,
    connect,
    disconnect,
    signAndSend,
    refreshBalance,
  };
}
