/**
 * Percolator API client for mobile app.
 *
 * Two API surfaces:
 * - Hono API: api.percolatorlaunch.com (markets, funding, OI, insurance, trades, stats)
 * - Next.js API: percolatorlaunch.com/api (leaderboard, trader stats, stake pools, market creation)
 */

// All market/stats data served via percolatorlaunch.com/api (Next.js proxy to Supabase).
// The old Railway direct URL requires auth headers not available on mobile.
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://percolatorlaunch.com/api';
const WEB_API_BASE = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://percolatorlaunch.com/api';

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
  totalOpenInterest: number;
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

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export const api = {
  // ── Hono API (api.percolatorlaunch.com) ──

  /** List all markets with stats */
  async getMarkets(): Promise<MarketData[]> {
    const data = await fetchJSON<{ markets: MarketData[] }>(`${API_BASE}/markets`);
    return data.markets;
  },

  /** Get single market by slab address */
  async getMarket(slab: string): Promise<MarketData> {
    const data = await fetchJSON<{ market: MarketData }>(`${API_BASE}/markets/${slab}`);
    return data.market;
  },

  /** Get latest prices for all markets */
  async getPrices(): Promise<PriceData[]> {
    const data = await fetchJSON<{ markets: PriceData[] }>(`${API_BASE}/prices/markets`);
    return data.markets;
  },

  /** Get price history for a market */
  async getPriceHistory(slab: string): Promise<PriceData[]> {
    const data = await fetchJSON<{ prices: PriceData[] }>(`${API_BASE}/prices/${slab}`);
    return data.prices;
  },

  /** Get recent trades for a market */
  async getTrades(slab: string): Promise<TradeData[]> {
    const data = await fetchJSON<{ trades: TradeData[] }>(`${API_BASE}/markets/${slab}/trades`);
    return data.trades;
  },

  /** Get market stats */
  async getStats(slab: string): Promise<Record<string, unknown>> {
    return fetchJSON(`${API_BASE}/markets/${slab}/stats`);
  },

  /** Get funding rate for a market (includes 24h history) */
  async getFunding(slab: string): Promise<{ rate: number; nextAt: string }> {
    return fetchJSON(`${API_BASE}/funding/${slab}`);
  },

  /** Get detailed funding rate with 24h history */
  async getFundingDetails(slab: string): Promise<{
    hourlyRatePercent: number;
    dailyRatePercent: number;
    annualizedPercent: number;
    last24hHistory: { timestamp: string; rate: number }[];
  }> {
    return fetchJSON(`${API_BASE}/funding/${slab}`);
  },

  /** Get open interest data with history */
  async getOpenInterest(slab: string): Promise<{
    totalOpenInterest: number;
    history: { timestamp: string; totalOi: number }[];
  }> {
    return fetchJSON(`${API_BASE}/open-interest/${slab}`);
  },

  /** Get insurance fund data */
  async getInsurance(slab: string): Promise<InsuranceData> {
    const raw = await fetchJSON<InsuranceData>(`${API_BASE}/insurance/${slab}`);
    // API returns e6 micro-units — convert to whole USD/token units
    return {
      ...raw,
      currentBalance: raw.currentBalance / 1_000_000,
      feeRevenue: raw.feeRevenue / 1_000_000,
      totalOpenInterest: raw.totalOpenInterest / 1_000_000,
      history: raw.history.map((h) => ({ ...h, balance: h.balance / 1_000_000 })),
    };
  },

  /** Get platform aggregate stats */
  async getPlatformStats(): Promise<PlatformStats> {
    return fetchJSON(`${API_BASE}/stats`);
  },

  /** Get 24h volume for a market */
  async getVolume(slab: string): Promise<{ volume24h: number; tradeCount: number }> {
    return fetchJSON(`${API_BASE}/markets/${slab}/volume`);
  },

  /** Health check */
  async health(): Promise<{ status: string }> {
    return fetchJSON(`${API_BASE}/health`);
  },

  // ── Next.js API (percolatorlaunch.com/api) ──

  /** Get leaderboard rankings */
  async getLeaderboard(period?: string): Promise<{ traders: LeaderboardEntry[] }> {
    const query = period ? `?period=${period}` : '';
    const data = await fetchJSON<Record<string, unknown>>(`${WEB_API_BASE}/leaderboard${query}`);
    // API may return { leaderboard: [...] } or { traders: [...] }
    const traders = (data.traders ?? data.leaderboard ?? []) as LeaderboardEntry[];
    return { traders };
  },

  /** Get trader stats for a wallet */
  async getTraderStats(wallet: string): Promise<TraderStats> {
    return fetchJSON(`${WEB_API_BASE}/trader/${wallet}/stats`);
  },

  /** Get trade history for a wallet */
  async getTraderTrades(wallet: string): Promise<{ trades: TraderTrade[] }> {
    return fetchJSON(`${WEB_API_BASE}/trader/${wallet}/trades`);
  },

  /** Get stake pools */
  async getStakePools(): Promise<StakePool[]> {
    const data = await fetchJSON<{ pools: any[] }>(`${WEB_API_BASE}/stake/pools`);
    return (data.pools ?? []).map((p) => ({
      ...p,
      cooldownSeconds: p.cooldownSeconds ?? Math.round((p.cooldownSlots ?? 0) * 0.4),
    }));
  },
};
