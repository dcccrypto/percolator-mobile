import { create } from 'zustand';
import { PublicKey } from '@solana/web3.js';

interface WalletStore {
  connected: boolean;
  publicKey: PublicKey | null;
  balance: number | null;

  // GH #111 — global flag so ConnectWalletSheet in RootNavigator fires from
  // any screen (Portfolio "Connect Wallet" or wizard Step 3 "CONNECT WALLET TO
  // LAUNCH").  Previously this was local state in useMWA(), which meant each
  // hook instance had its own copy and the RootNavigator instance never saw it.
  showInstallSheet: boolean;

  setConnected: (pubkey: PublicKey) => void;
  setDisconnected: () => void;
  setBalance: (balance: number | null) => void;
  setShowInstallSheet: (show: boolean) => void;
}

export const useWalletStore = create<WalletStore>((set) => ({
  connected: false,
  publicKey: null,
  balance: null,
  showInstallSheet: false,

  setConnected: (pubkey) =>
    set({ connected: true, publicKey: pubkey }),

  setDisconnected: () =>
    set({ connected: false, publicKey: null, balance: null }),

  setBalance: (balance) => set({ balance }),
  setShowInstallSheet: (show) => set({ showInstallSheet: show }),
}));
