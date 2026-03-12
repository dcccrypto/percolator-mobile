/**
 * Tests for walletStore — covers GH #111 global showInstallSheet flag.
 *
 * We unmock walletStore here so we test the real Zustand store, not the
 * jest.setup.js mock used by all other test files.
 */

// Must come before any imports that load walletStore
jest.unmock('../../src/store/walletStore');

import { useWalletStore } from '../../src/store/walletStore';

describe('walletStore — showInstallSheet (GH #111)', () => {
  beforeEach(() => {
    // Confirm the store has the expected API (fails loudly if Zustand compat breaks)
    const store = useWalletStore as unknown as { getState: () => ReturnType<typeof useWalletStore> };
    if (typeof store.getState !== 'function') {
      throw new Error('useWalletStore.getState is not available — check Zustand version compat');
    }
    (store.getState() as any).setDisconnected();
    (store.getState() as any).setShowInstallSheet(false);
  });

  it('initialises with showInstallSheet=false', () => {
    const store = useWalletStore as unknown as { getState: () => any };
    expect(store.getState().showInstallSheet).toBe(false);
  });

  it('setShowInstallSheet(true) updates global flag', () => {
    const store = useWalletStore as unknown as { getState: () => any };
    store.getState().setShowInstallSheet(true);
    expect(store.getState().showInstallSheet).toBe(true);
  });

  it('setShowInstallSheet(false) clears the flag', () => {
    const store = useWalletStore as unknown as { getState: () => any };
    store.getState().setShowInstallSheet(true);
    store.getState().setShowInstallSheet(false);
    expect(store.getState().showInstallSheet).toBe(false);
  });

  it('setDisconnected clears wallet but leaves showInstallSheet (needs explicit dismiss)', () => {
    const store = useWalletStore as unknown as { getState: () => any };
    store.getState().setShowInstallSheet(true);
    store.getState().setDisconnected();
    // showInstallSheet must be cleared separately via dismissInstallSheet
    expect(store.getState().showInstallSheet).toBe(true);
    expect(store.getState().connected).toBe(false);
    expect(store.getState().publicKey).toBeNull();
  });
});
