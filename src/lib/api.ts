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

export interface LeaderboardEntry {
  rank: number;
  wallet: string;
  tradeCount: number;
  volume: number;
  pnl: number;
}

export interface TraderStats {
  totalTrades: number;
  winRate: number;
  totalVolume: number;
  totalPnl: number;
  avgLeverage: number;
}

export interface TraderTrade {
  id: string;
  market: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  pnl: number;
  timestamp: string;
  signature?: string;
}

export interface InsuranceData {
  currentBalance: number;
  feeRevenue: number;
  history: { timestamp: string; balance: number }[];
}

export interface PlatformStats {
  totalMarkets: number;
  volume24h: number;
  totalOpenInterest: number;
  uniqueDeployers: number;
  trades24h: number;
}

export interface StakePool {
  id: string;
  name: string;
  market: string;
  tvl: number;
  apr: number | null;
  capUsed: number;
  capMax: number;
  cooldownSeconds: number;
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

  /** Get detailed funding rate with 24h history */
  async getFundingDetails(slab: string): Promise<{
    hourlyRatePercent: number;
    dailyRatePercent: number;
    annualizedPercent: number;
    last24hHistory: { timestamp: string; rate: number }[];
  }> {
    return fetchJSON(`/funding/${slab}/details`);
  },

  /** Get open interest data with history */
  async getOpenInterest(slab: string): Promise<{
    totalOpenInterest: number;
    history: { timestamp: string; totalOi: number }[];
  }> {
    return fetchJSON(`/oi/${slab}`);
  },

  /** Get leaderboard rankings */
  async getLeaderboard(period?: string): Promise<{ traders: LeaderboardEntry[] }> {
    const query = period ? `?period=${period}` : '';
    return fetchJSON(`/leaderboard${query}`);
  },

  /** Get trader stats for a wallet */
  async getTraderStats(wallet: string): Promise<TraderStats> {
    return fetchJSON(`/trader/${wallet}/stats`);
  },

  /** Get trade history for a wallet */
  async getTraderTrades(wallet: string): Promise<{ trades: TraderTrade[] }> {
    return fetchJSON(`/trader/${wallet}/trades`);
  },

  /** Get insurance fund data */
  async getInsurance(slab: string): Promise<InsuranceData> {
    return fetchJSON(`/insurance/${slab}`);
  },

  /** Get platform aggregate stats */
  async getPlatformStats(): Promise<PlatformStats> {
    return fetchJSON('/stats');
  },

  /** Get stake pools */
  async getStakePools(): Promise<StakePool[]> {
    const data = await fetchJSON<{ pools: StakePool[] }>('/stake/pools');
    return data.pools;
  },

  /** Health check */
  async health(): Promise<{ status: string }> {
    return fetchJSON('/health');
  },
};
