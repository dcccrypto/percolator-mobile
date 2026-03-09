import { create } from 'zustand';
import { PublicKey } from '@solana/web3.js';

interface WalletStore {
  connected: boolean;
  publicKey: PublicKey | null;
  balance: number | null;

  setConnected: (pubkey: PublicKey) => void;
  setDisconnected: () => void;
  setBalance: (balance: number | null) => void;
}

export const useWalletStore = create<WalletStore>((set) => ({
  connected: false,
  publicKey: null,
  balance: null,

  setConnected: (pubkey) =>
    set({ connected: true, publicKey: pubkey }),

  setDisconnected: () =>
    set({ connected: false, publicKey: null, balance: null }),

  setBalance: (balance) => set({ balance }),
}));
