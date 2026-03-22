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

/**
 * MarketData — camelCase consumer-facing interface.
 *
 * The /api/markets endpoint returns snake_case fields (slab_address, logo_url, etc.)
 * which are normalised to camelCase inside normalizeMarket() before being returned
 * from api.getMarkets() / api.getMarket().
 *
 * Fields not present in the API response:
 *  - status: derived from is_zombie (false → 'active', true → 'zombie')
 *  - volume24h: mapped from volume_24h_usd (preferred) or volume_24h (raw atom fallback)
 */
export interface MarketData {
  slabAddress: string;
  mintAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  maxLeverage: number;
  tradingFeeBps: number;
  /** 'active' | 'zombie' — derived from is_zombie field */
  status: string;
  logoUrl: string | null;
  totalOpenInterest: number | null;
  totalAccounts: number | null;
  lastPrice: number | null;
  markPrice: number | null;
  indexPrice: number | null;
  fundingRate: number | null;
  /** 24h volume in USD (volume_24h_usd when available, else raw volume_24h atom) */
  volume24h: number | null;
  isZombie: boolean;
  /** ISO-8601 timestamp when the market was created (from created_at), or null if not available */
  createdAt: string | null;
}

/**
 * Raw snake_case response from /api/markets endpoint.
 * Only the fields we actually read are declared; the rest are ignored.
 */
interface RawMarketData {
  slab_address: string;
  mint_address: string;
  symbol: string;
  name: string;
  decimals: number;
  max_leverage: number;
  trading_fee_bps: number;
  logo_url: string | null;
  total_open_interest: number | null;
  total_accounts: number | null;
  last_price: number | null;
  mark_price: number | null;
  index_price: number | null;
  funding_rate: number | null;
  volume_24h: number | null;
  volume_24h_usd: number | null;
  is_zombie: boolean;
  created_at?: string | null;
}

/**
 * Normalise a single raw API market (snake_case) to the camelCase MarketData shape.
 */
function normalizeMarket(m: RawMarketData): MarketData {
  return {
    slabAddress: m.slab_address,
    mintAddress: m.mint_address ?? '',
    symbol: m.symbol,
    name: m.name,
    decimals: m.decimals ?? 6,
    maxLeverage: m.max_leverage,
    tradingFeeBps: m.trading_fee_bps,
    status: m.is_zombie ? 'zombie' : 'active',
    logoUrl: m.logo_url ?? null,
    totalOpenInterest: m.total_open_interest ?? null,
    totalAccounts: m.total_accounts ?? null,
    lastPrice: m.last_price ?? null,
    markPrice: m.mark_price ?? null,
    indexPrice: m.index_price ?? null,
    fundingRate: m.funding_rate ?? null,
    volume24h: m.volume_24h_usd ?? m.volume_24h ?? null,
    isZombie: m.is_zombie ?? false,
    createdAt: m.created_at ?? null,
  };
}

/** Raw price snapshot returned by /api/prices/markets. */
interface PriceData {
  slab_address: string;
  last_price: number;
  mark_price: number;
  index_price: number;
  updated_at: string;
}

/** Individual trade event returned by /api/markets/:slab/trades. */
interface TradeData {
  id: string;
  slab_address: string;
  side: 'long' | 'short';
  size: number;
  price: number;
  timestamp: string;
}

/** A trader's open position on a Percolator market. */
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

/** Single row from the trader leaderboard. */
export interface LeaderboardEntry {
  rank: number;
  wallet: string;
  tradeCount: number;
  volume: number;
  pnl: number;
}

/** Aggregate trading stats for a single wallet. */
export interface TraderStats {
  totalTrades: number;
  winRate: number;
  totalVolume: number;
  totalPnl: number;
  avgLeverage: number;
}

/** A single completed trade for a wallet from /api/trader/:wallet/trades. */
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

/** Insurance fund snapshot and historical balance series for a market. */
export interface InsuranceData {
  currentBalance: number;
  feeRevenue: number;
  totalOpenInterest: number;
  history: { timestamp: string; balance: number }[];
}

/** Platform-wide aggregate statistics from /api/stats. */
export interface PlatformStats {
  totalMarkets: number;
  volume24h: number;
  totalOpenInterest: number;
  uniqueDeployers: number;
  trades24h: number;
}

/** A single liquidity stake pool for a Percolator market. */
export interface StakePool {
  id: string;
  name: string;
  market: string;
  /** Slab (market) on-chain address */
  slabAddress: string;
  /** Collateral mint for this pool */
  collateralMint: string;
  tvl: number;
  apr: number | null;
  capUsed: number;
  capMax: number;
  cooldownSeconds: number;
}

/**
 * Thin fetch wrapper — parses JSON and throws descriptive errors on HTTP failures.
 * Translates 429 responses to a user-friendly rate-limit message.
 */
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('Too many requests — please wait a moment and try again');
    }
    const statusText = res.statusText || `Error ${res.status}`;
    throw new Error(`Request failed: ${statusText}`);
  }
  return res.json();
}

export const api = {
  // ── Next.js API (percolatorlaunch.com/api) ──

  /** List all markets with stats — normalises snake_case → camelCase */
  async getMarkets(): Promise<MarketData[]> {
    const data = await fetchJSON<{ markets: RawMarketData[] }>(`${API_BASE}/markets`);
    return (data.markets ?? []).map(normalizeMarket);
  },

  /** Get single market by slab address — normalises snake_case → camelCase */
  async getMarket(slab: string): Promise<MarketData> {
    const data = await fetchJSON<{ market: RawMarketData }>(`${API_BASE}/markets/${slab}`);
    return normalizeMarket(data.market);
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
    return (data.pools ?? [])
      .filter(
        (p) =>
          (p.poolAddress ?? p.id ?? p.slabAddress) &&
          p.slabAddress &&
          p.collateralMint,
      )
      .map((p) => ({
        id: p.poolAddress ?? p.id ?? p.slabAddress,
        name: p.name ?? `Pool ${(p.slabAddress ?? '').slice(0, 8)}`,
        market: p.symbol ?? p.name ?? '',
        slabAddress: p.slabAddress,
        collateralMint: p.collateralMint,
        tvl: p.tvl ?? 0,
        apr: p.apr ?? null,
        capUsed: p.capUsed ?? 0,
        capMax: p.capTotal ?? p.capMax ?? 0,
        cooldownSeconds: p.cooldownSeconds ?? Math.round((p.cooldownSlots ?? 0) * 0.4),
      }));
  },
};
