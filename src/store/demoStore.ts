/**
 * Demo mode store — tracks whether the user is in demo/guest mode.
 *
 * Demo mode lets users explore the app without a wallet connection.
 * Called from OnboardingScreen "Try Demo Mode" CTA.
 */
import { create } from 'zustand';

interface DemoState {
  isDemo: boolean;
  enterDemo: () => void;
  exitDemo: () => void;
}

export const useDemoStore = create<DemoState>((set) => ({
  isDemo: false,
  enterDemo: () => set({ isDemo: true }),
  exitDemo: () => set({ isDemo: false }),
}));

// ---------------------------------------------------------------------------
// Demo data — used when isDemo = true to populate screens without a wallet
// ---------------------------------------------------------------------------

export interface DemoMarket {
  slabAddress: string;
  symbol: string;
  name: string;
  lastPrice: number;
  change24h: number;
  volume24h: number;
  openInterest: number;
  maxLeverage: number;
}

export const DEMO_MARKETS: DemoMarket[] = [
  {
    slabAddress: 'DEMOsol111111111111111111111111111111111111',
    symbol: 'SOL-PERP',
    name: 'Solana Perpetual',
    lastPrice: 178.42,
    change24h: 3.21,
    volume24h: 4_200_000,
    openInterest: 1_800_000,
    maxLeverage: 20,
  },
  {
    slabAddress: 'DEMObtc111111111111111111111111111111111111',
    symbol: 'BTC-PERP',
    name: 'Bitcoin Perpetual',
    lastPrice: 68_500,
    change24h: -1.05,
    volume24h: 12_000_000,
    openInterest: 5_400_000,
    maxLeverage: 20,
  },
  {
    slabAddress: 'DEMOeth111111111111111111111111111111111111',
    symbol: 'ETH-PERP',
    name: 'Ethereum Perpetual',
    lastPrice: 3_420,
    change24h: 0.88,
    volume24h: 6_800_000,
    openInterest: 2_900_000,
    maxLeverage: 20,
  },
];

export interface DemoPosition {
  slabAddress: string;
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  pnl: number;
  leverage: number;
}

export const DEMO_POSITIONS: DemoPosition[] = [
  {
    slabAddress: DEMO_MARKETS[0].slabAddress,
    symbol: 'SOL-PERP',
    direction: 'long',
    size: 10,
    entryPrice: 172.5,
    markPrice: 178.42,
    pnl: 59.2,
    leverage: 5,
  },
];

/** Generate a simple random-walk price history for demo charts. */
export function demoPriceHistory(basePrice: number, points: number): number[] {
  const prices: number[] = [];
  let price = basePrice * 0.95;
  const step = (basePrice - price) / points;
  for (let i = 0; i < points - 1; i++) {
    const noise = (Math.random() - 0.5) * basePrice * 0.01;
    price = Math.max(price + step + noise, 0.0001);
    prices.push(price);
  }
  prices.push(basePrice);
  return prices;
}

/** Simulate a demo trade and return a fake transaction signature. */
export function demoTrade(
  direction: 'long' | 'short',
  symbol: string,
  size: number,
): { signature: string; direction: string; symbol: string; size: number } {
  const hash = `${direction}${symbol}${size}`
    .split('')
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
    .padEnd(32, '0');
  const signature = (hash + hash).slice(0, 64);
  return { signature, direction, symbol, size };
}
