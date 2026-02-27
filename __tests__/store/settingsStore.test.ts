/**
 * Tests for src/store/settingsStore.ts — Zustand settings store with SecureStore persistence.
 */
import * as SecureStore from 'expo-secure-store';
import { useSettingsStore } from '../../src/store/settingsStore';

jest.mock('expo-secure-store');

describe('settingsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store
    useSettingsStore.setState({
      defaultLeverage: '5x',
      slippageTolerance: '0.5%',
      priceAlerts: true,
      hapticFeedback: true,
      network: 'devnet',
      rpcEndpoint: 'Default',
      explorer: 'SolanaFM',
      loaded: false,
    });
  });

  it('has correct default values', () => {
    const state = useSettingsStore.getState();
    expect(state.defaultLeverage).toBe('5x');
    expect(state.slippageTolerance).toBe('0.5%');
    expect(state.priceAlerts).toBe(true);
    expect(state.hapticFeedback).toBe(true);
    expect(state.network).toBe('devnet');
    expect(state.rpcEndpoint).toBe('Default');
    expect(state.explorer).toBe('SolanaFM');
    expect(state.loaded).toBe(false);
  });

  describe('load', () => {
    it('sets loaded to true when no stored data', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

      await useSettingsStore.getState().load();

      expect(useSettingsStore.getState().loaded).toBe(true);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('percolator_settings');
    });

    it('loads persisted settings from SecureStore', async () => {
      const saved = {
        defaultLeverage: '10x',
        network: 'mainnet-beta',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(saved),
      );

      await useSettingsStore.getState().load();

      const state = useSettingsStore.getState();
      expect(state.loaded).toBe(true);
      expect(state.defaultLeverage).toBe('10x');
      expect(state.network).toBe('mainnet-beta');
      // Defaults preserved for non-overridden fields
      expect(state.priceAlerts).toBe(true);
      expect(state.hapticFeedback).toBe(true);
    });

    it('gracefully handles SecureStore read error', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(
        new Error('SecureStore unavailable'),
      );

      await useSettingsStore.getState().load();

      expect(useSettingsStore.getState().loaded).toBe(true);
    });

    it('handles corrupt JSON in SecureStore', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(
        'not valid json {{{',
      );

      // Should not throw
      await useSettingsStore.getState().load();
      expect(useSettingsStore.getState().loaded).toBe(true);
    });
  });

  describe('update', () => {
    it('updates partial settings', async () => {
      await useSettingsStore.getState().update({ defaultLeverage: '20x' });

      expect(useSettingsStore.getState().defaultLeverage).toBe('20x');
      // Other settings untouched
      expect(useSettingsStore.getState().network).toBe('devnet');
    });

    it('persists to SecureStore', async () => {
      await useSettingsStore.getState().update({
        hapticFeedback: false,
        slippageTolerance: '1%',
      });

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'percolator_settings',
        expect.any(String),
      );

      // Verify the persisted data
      const call = (SecureStore.setItemAsync as jest.Mock).mock.calls[0];
      const persisted = JSON.parse(call[1]);
      expect(persisted.hapticFeedback).toBe(false);
      expect(persisted.slippageTolerance).toBe('1%');
    });

    it('handles SecureStore write error gracefully', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Write failed'),
      );

      // Should not throw — "best effort" pattern
      await useSettingsStore.getState().update({ network: 'mainnet-beta' });

      // State still updated in memory even if persistence fails
      expect(useSettingsStore.getState().network).toBe('mainnet-beta');
    });

    it('can update multiple fields at once', async () => {
      await useSettingsStore.getState().update({
        defaultLeverage: '3x',
        priceAlerts: false,
        explorer: 'Solscan',
      });

      const state = useSettingsStore.getState();
      expect(state.defaultLeverage).toBe('3x');
      expect(state.priceAlerts).toBe(false);
      expect(state.explorer).toBe('Solscan');
    });
  });
});
