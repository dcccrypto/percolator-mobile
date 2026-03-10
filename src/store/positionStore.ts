/**
 * Position store — tracks open position count for the portfolio tab badge.
 * Written to by PortfolioScreen after positions load; read by RootNavigator.
 */
import { create } from 'zustand';

interface PositionStore {
  openPositionCount: number;
  setOpenPositionCount: (count: number) => void;
  /** Bump to force usePositions to re-fetch on-chain data (e.g. after deposit/withdraw). */
  refreshTick: number;
  triggerRefresh: () => void;
}

export const usePositionStore = create<PositionStore>((set) => ({
  openPositionCount: 0,
  setOpenPositionCount: (count) => set({ openPositionCount: count }),
  refreshTick: 0,
  triggerRefresh: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),
}));
