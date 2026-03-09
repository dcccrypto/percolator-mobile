/**
 * Percolator API client for mobile app.
 *
 * Two API surfaces:
 * - Hono API: api.percolatorlaunch.com (markets, funding, OI, insurance, trades, stats)
 * - Next.js API: percolatorlaunch.com/api (leaderboard, trader stats, stake pools, market creation)
 *
 * This layer normalizes backend responses to the interfaces the mobile app expects,
 * handling field name differences (snake_case → camelCase) and type coercions
 * (stringified BigInts → numbers).
 */

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.percolatorlaunch.com';
const WEB_API_BASE = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://percolatorlaunch.com/api';

/** Safely coerce a value that may be a string (BigInt) to number. */
function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || 0;
  return 0;
}

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

// Solana slot duration in seconds (for cooldownSlots → cooldownSeconds)
const SLOT_DURATION_S = 0.4;

export const api = {
  // ── Hono API (api.percolatorlaunch.com) ──

  /** List all markets with stats */
  async getMarkets(): Promise<MarketData[]> {
    const data = await fetchJSON<{ markets: MarketData[] }>(`${API_BASE}/markets`);
    return data.markets;
  },

  /** Get single market by slab address — falls back to list endpoint for consistent shape */
  async getMarket(slab: string): Promise<MarketData> {
    // /markets/:slab returns on-chain struct (header/config/engine), not MarketData.
    // Use the list endpoint and filter for consistent response shape.
    const markets = await api.getMarkets();
    const market = markets.find((m) => m.slabAddress === slab);
    if (!market) throw new Error(`Market ${slab} not found`);
    return market;
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

  /** Get detailed funding rate with 24h history.
   *  Backend returns rateBpsPerSlot in history; we normalize to { rate } for the hook. */
  async getFundingDetails(slab: string): Promise<{
    hourlyRatePercent: number;
    dailyRatePercent: number;
    annualizedPercent: number;
    last24hHistory: { timestamp: string; rate: number }[];
  }> {
    const raw = await fetchJSON<Record<string, any>>(`${API_BASE}/funding/${slab}`);
    return {
      hourlyRatePercent: toNum(raw.hourlyRatePercent),
      dailyRatePercent: toNum(raw.dailyRatePercent),
      annualizedPercent: toNum(raw.annualizedPercent),
      last24hHistory: (raw.last24hHistory ?? []).map((h: any) => ({
        timestamp: h.timestamp,
        rate: toNum(h.rateBpsPerSlot ?? h.rate),
      })),
    };
  },

  /** Get open interest data with history.
   *  Backend returns totalOpenInterest as string; we coerce to number. */
  async getOpenInterest(slab: string): Promise<{
    totalOpenInterest: number;
    history: { timestamp: string; totalOi: number }[];
  }> {
    const raw = await fetchJSON<Record<string, any>>(`${API_BASE}/open-interest/${slab}`);
    return {
      totalOpenInterest: toNum(raw.totalOpenInterest),
      history: (raw.history ?? []).map((h: any) => ({
        timestamp: h.timestamp,
        totalOi: toNum(h.totalOi),
      })),
    };
  },

  /** Get insurance fund data.
   *  Backend returns all numeric fields as strings; we coerce to numbers. */
  async getInsurance(slab: string): Promise<InsuranceData> {
    const raw = await fetchJSON<Record<string, any>>(`${API_BASE}/insurance/${slab}`);
    return {
      currentBalance: toNum(raw.currentBalance),
      feeRevenue: toNum(raw.feeRevenue),
      totalOpenInterest: toNum(raw.totalOpenInterest),
      history: (raw.history ?? []).map((h: any) => ({
        timestamp: h.timestamp,
        balance: toNum(h.balance),
      })),
    };
  },

  /** Get platform aggregate stats.
   *  Backend returns volume24h and totalOpenInterest as strings. */
  async getPlatformStats(): Promise<PlatformStats> {
    const raw = await fetchJSON<Record<string, any>>(`${API_BASE}/stats`);
    return {
      totalMarkets: toNum(raw.totalMarkets),
      volume24h: toNum(raw.volume24h),
      totalOpenInterest: toNum(raw.totalOpenInterest),
      uniqueDeployers: toNum(raw.uniqueDeployers),
      trades24h: toNum(raw.trades24h),
    };
  },

  /** Get 24h volume for a market.
   *  Backend returns snake_case (volume_24h, trade_count_24h). */
  async getVolume(slab: string): Promise<{ volume24h: number; tradeCount: number }> {
    const raw = await fetchJSON<Record<string, any>>(`${API_BASE}/markets/${slab}/volume`);
    return {
      volume24h: toNum(raw.volume_24h ?? raw.volume24h),
      tradeCount: toNum(raw.trade_count_24h ?? raw.tradeCount),
    };
  },

  /** Health check */
  async health(): Promise<{ status: string }> {
    return fetchJSON(`${API_BASE}/health`);
  },

  // ── Next.js API (percolatorlaunch.com/api) ──

  /** Get leaderboard rankings.
   *  Backend returns { leaderboard: [{ trader, totalVolume, ... }] };
   *  we normalize to { traders: [{ wallet, volume, ... }] }. */
  async getLeaderboard(period?: string): Promise<{ traders: LeaderboardEntry[] }> {
    const query = period ? `?period=${period}` : '';
    const raw = await fetchJSON<Record<string, any>>(`${WEB_API_BASE}/leaderboard${query}`);
    const entries: any[] = raw.leaderboard ?? raw.traders ?? [];
    return {
      traders: entries.map((e: any, i: number) => ({
        rank: e.rank ?? i + 1,
        wallet: e.trader ?? e.wallet ?? '',
        tradeCount: toNum(e.tradeCount ?? e.trade_count),
        volume: toNum(e.totalVolume ?? e.volume),
        pnl: toNum(e.pnl ?? e.totalPnl ?? 0),
      })),
    };
  },

  /** Get trader stats for a wallet.
   *  Backend returns different fields; we compute missing ones where possible. */
  async getTraderStats(wallet: string): Promise<TraderStats> {
    const raw = await fetchJSON<Record<string, any>>(`${WEB_API_BASE}/trader/${wallet}/stats`);
    const totalTrades = toNum(raw.totalTrades);
    const longTrades = toNum(raw.longTrades);
    // winRate: backend doesn't provide it; approximate from long ratio if available
    const winRate = toNum(raw.winRate ?? (totalTrades > 0 ? (longTrades / totalTrades) * 100 : 0));
    return {
      totalTrades,
      winRate,
      totalVolume: toNum(raw.totalVolume),
      totalPnl: toNum(raw.totalPnl ?? raw.totalFees ?? 0),
      avgLeverage: toNum(raw.avgLeverage ?? 0),
    };
  },

  /** Get trade history for a wallet.
   *  Backend uses slab_address, created_at, tx_signature, fee; we normalize. */
  async getTraderTrades(wallet: string): Promise<{ trades: TraderTrade[] }> {
    const raw = await fetchJSON<Record<string, any>>(`${WEB_API_BASE}/trader/${wallet}/trades`);
    const entries: any[] = raw.trades ?? [];
    return {
      trades: entries.map((t: any) => ({
        id: t.id ?? '',
        market: t.market ?? t.slab_address ?? '',
        side: t.side ?? 'long',
        size: toNum(t.size),
        entryPrice: toNum(t.entryPrice ?? t.price ?? 0),
        pnl: toNum(t.pnl ?? t.fee ?? 0),
        timestamp: t.timestamp ?? t.created_at ?? '',
        signature: t.signature ?? t.tx_signature ?? undefined,
      })),
    };
  },

  /** Get stake pools.
   *  Backend returns poolAddress, slabAddress, capTotal, cooldownSlots; we normalize. */
  async getStakePools(): Promise<StakePool[]> {
    const raw = await fetchJSON<{ pools: any[] }>(`${WEB_API_BASE}/stake/pools`);
    return (raw.pools ?? []).map((p: any) => ({
      id: p.id ?? p.poolAddress ?? '',
      name: p.name ?? p.symbol ?? '',
      market: p.market ?? p.slabAddress ?? '',
      tvl: toNum(p.tvl),
      apr: p.apr != null ? toNum(p.apr) : null,
      capUsed: toNum(p.capUsed),
      capMax: toNum(p.capMax ?? p.capTotal),
      cooldownSeconds: toNum(p.cooldownSeconds ?? (toNum(p.cooldownSlots) * SLOT_DURATION_S)),
    }));
  },
};
