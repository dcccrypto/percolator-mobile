/**
 * Tests for src/store/marketStore.ts — Zustand market store.
 */
import { useMarketStore } from '../../src/store/marketStore';

describe('marketStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useMarketStore.setState({
      selectedMarket: null,
      userIdx: 0,
    });
  });

  it('initializes with null selectedMarket', () => {
    const state = useMarketStore.getState();
    expect(state.selectedMarket).toBeNull();
  });

  it('initializes with userIdx = 0', () => {
    const state = useMarketStore.getState();
    expect(state.userIdx).toBe(0);
  });

  it('setSelectedMarket updates the selected market', () => {
    const market = { slabAddress: 'slab123', symbol: 'SOL-PERP' };
    useMarketStore.getState().setSelectedMarket(market);

    const state = useMarketStore.getState();
    expect(state.selectedMarket).toEqual(market);
  });

  it('setUserIdx updates the user index', () => {
    useMarketStore.getState().setUserIdx(5);

    const state = useMarketStore.getState();
    expect(state.userIdx).toBe(5);
  });

  it('can change selected market multiple times', () => {
    const store = useMarketStore.getState();

    store.setSelectedMarket({ slabAddress: 'slab1', symbol: 'SOL-PERP' });
    expect(useMarketStore.getState().selectedMarket?.symbol).toBe('SOL-PERP');

    store.setSelectedMarket({ slabAddress: 'slab2', symbol: 'BTC-PERP' });
    expect(useMarketStore.getState().selectedMarket?.symbol).toBe('BTC-PERP');
    expect(useMarketStore.getState().selectedMarket?.slabAddress).toBe('slab2');
  });

  it('setting market does not reset userIdx', () => {
    const store = useMarketStore.getState();
    store.setUserIdx(3);
    store.setSelectedMarket({ slabAddress: 'slab1', symbol: 'SOL-PERP' });

    expect(useMarketStore.getState().userIdx).toBe(3);
  });
});
