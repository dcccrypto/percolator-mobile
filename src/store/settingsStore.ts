/**
 * Settings store — persists user preferences using SecureStore.
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const SETTINGS_KEY = 'percolator_settings';

interface Settings {
  defaultLeverage: string;
  slippageTolerance: string;
  priceAlerts: boolean;
  hapticFeedback: boolean;
  network: 'devnet' | 'mainnet-beta';
  rpcEndpoint: string;
  explorer: 'SolanaFM' | 'Solscan' | 'Solana Explorer';
}

interface SettingsStore extends Settings {
  loaded: boolean;
  load: () => Promise<void>;
  update: (partial: Partial<Settings>) => Promise<void>;
  setNetwork: (network: string) => void;
  save: () => Promise<void>;
}

const DEFAULTS: Settings = {
  defaultLeverage: '5x',
  slippageTolerance: '0.5%',
  priceAlerts: true,
  hapticFeedback: true,
  network: 'devnet',
  rpcEndpoint: 'Default',
  explorer: 'SolanaFM',
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  load: async () => {
    try {
      const raw = await SecureStore.getItemAsync(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>;
        set({ ...DEFAULTS, ...parsed, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  save: async () => {
    const current = get();
    const toSave: Settings = {
      defaultLeverage: current.defaultLeverage,
      slippageTolerance: current.slippageTolerance,
      priceAlerts: current.priceAlerts,
      hapticFeedback: current.hapticFeedback,
      network: current.network,
      rpcEndpoint: current.rpcEndpoint,
      explorer: current.explorer,
    };
    try {
      await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(toSave));
    } catch {
      // Best effort
    }
  },

  setNetwork: (network: string) => {
    set({ network: network as Settings['network'] });
    get().save();
  },

  update: async (partial: Partial<Settings>) => {
    const current = get();
    const next: Settings = {
      defaultLeverage: partial.defaultLeverage ?? current.defaultLeverage,
      slippageTolerance: partial.slippageTolerance ?? current.slippageTolerance,
      priceAlerts: partial.priceAlerts ?? current.priceAlerts,
      hapticFeedback: partial.hapticFeedback ?? current.hapticFeedback,
      network: partial.network ?? current.network,
      rpcEndpoint: partial.rpcEndpoint ?? current.rpcEndpoint,
      explorer: partial.explorer ?? current.explorer,
    };
    set(next);
    try {
      await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // Best effort
    }
  },
}));
