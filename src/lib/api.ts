/**
 * Percolator API client for mobile app.
 * Connects to the percolator-launch API (Hono-based).
 */

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.percolatorlaunch.com';

interface MarketData {
  slabAddress: string;
  mintAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  maxLeverage: number;
  tradingFeeBps: number;
  status: string;
  logoUrl: string | null;
  totalOpenInterest: number | null;
  totalAccounts: number | null;
  lastPrice: number | null;
  markPrice: number | null;
  indexPrice: number | null;
  fundingRate: number | null;
}

interface PriceData {
  slab_address: string;
  last_price: number;
  mark_price: number;
  index_price: number;
  updated_at: string;
}

interface TradeData {
  id: string;
  slab_address: string;
  side: 'long' | 'short';
  size: number;
  price: number;
  timestamp: string;
}

export interface Position {
  id: string;
  market: string;
  symbol: string;
  direction: 'long' | 'short';
  leverage: number;
  entryPrice: number;
  size: number;
  liqPrice: number;
  pnl: number;
  pnlPercent: number;
}

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export const api = {
  /** List all markets with stats */
  async getMarkets(): Promise<MarketData[]> {
    const data = await fetchJSON<{ markets: MarketData[] }>('/markets');
    return data.markets;
  },

  /** Get single market by slab address */
  async getMarket(slab: string): Promise<MarketData> {
    const data = await fetchJSON<{ market: MarketData }>(`/markets/${slab}`);
    return data.market;
  },

  /** Get latest prices for all markets */
  async getPrices(): Promise<PriceData[]> {
    const data = await fetchJSON<{ markets: PriceData[] }>('/prices/markets');
    return data.markets;
  },

  /** Get price history for a market */
  async getPriceHistory(slab: string): Promise<PriceData[]> {
    const data = await fetchJSON<{ prices: PriceData[] }>(`/prices/${slab}`);
    return data.prices;
  },

  /** Get recent trades for a market */
  async getTrades(slab: string): Promise<TradeData[]> {
    const data = await fetchJSON<{ trades: TradeData[] }>(`/trades/${slab}`);
    return data.trades;
  },

  /** Get stats for a market */
  async getStats(slab: string): Promise<Record<string, unknown>> {
    return fetchJSON(`/stats/${slab}`);
  },

  /** Get funding rate for a market */
  async getFunding(slab: string): Promise<{ rate: number; nextAt: string }> {
    return fetchJSON(`/funding/${slab}`);
  },

  /** Health check */
  async health(): Promise<{ status: string }> {
    return fetchJSON('/health');
  },
};
