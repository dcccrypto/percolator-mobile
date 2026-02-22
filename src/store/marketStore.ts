/**
 * Market store — holds the currently selected market.
 * MarketsScreen writes to it when user taps "Trade" on a market card.
 * TradeScreen reads from it to know which slab to trade on.
 */
import { create } from 'zustand';

interface SelectedMarket {
  slabAddress: string;
  symbol: string;
}

interface MarketStore {
  selectedMarket: SelectedMarket | null;
  userIdx: number; // user's account index on the selected slab (0 = first slot, set after InitUser)
  setSelectedMarket: (market: SelectedMarket) => void;
  setUserIdx: (idx: number) => void;
}

export const useMarketStore = create<MarketStore>((set) => ({
  selectedMarket: null,
  userIdx: 0,
  setSelectedMarket: (market) => set({ selectedMarket: market }),
  setUserIdx: (idx) => set({ userIdx: idx }),
}));
