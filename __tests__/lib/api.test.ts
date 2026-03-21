/**
 * Tests for src/lib/api.ts — Percolator API client.
 */

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

import { api } from '../../src/lib/api';

describe('api', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  // ---------------------------------------------------------------------------
  // getMarkets
  // ---------------------------------------------------------------------------
  describe('getMarkets', () => {
    it('normalises snake_case API response to camelCase MarketData', async () => {
      // API returns snake_case — this is the real response shape
      const rawMarket = {
        slab_address: 'slab1',
        mint_address: 'mint1',
        symbol: 'SOL-PERP',
        name: 'Solana Perpetual',
        decimals: 9,
        max_leverage: 20,
        trading_fee_bps: 5,
        logo_url: null,
        total_open_interest: 100000,
        total_accounts: 42,
        last_price: 145.5,
        mark_price: 145.6,
        index_price: 145.4,
        funding_rate: 0.001,
        volume_24h: 500000,
        volume_24h_usd: 1200000,
        is_zombie: false,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ markets: [rawMarket] }),
      });

      const result = await api.getMarkets();
      expect(result).toHaveLength(1);
      const m = result[0];

      // All fields should be camelCase
      expect(m.slabAddress).toBe('slab1');
      expect(m.mintAddress).toBe('mint1');
      expect(m.symbol).toBe('SOL-PERP');
      expect(m.name).toBe('Solana Perpetual');
      expect(m.decimals).toBe(9);
      expect(m.maxLeverage).toBe(20);
      expect(m.tradingFeeBps).toBe(5);
      expect(m.logoUrl).toBeNull();
      expect(m.totalOpenInterest).toBe(100000);
      expect(m.totalAccounts).toBe(42);
      expect(m.lastPrice).toBe(145.5);
      expect(m.markPrice).toBe(145.6);
      expect(m.indexPrice).toBe(145.4);
      expect(m.fundingRate).toBe(0.001);
      expect(m.volume24h).toBe(1200000); // prefers volume_24h_usd
      expect(m.status).toBe('active');
      expect(m.isZombie).toBe(false);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/markets'),
      );
    });

    it('derives status=zombie and isZombie=true from is_zombie:true', async () => {
      const rawMarket = {
        slab_address: 'slab2',
        mint_address: 'mint2',
        symbol: 'DEAD-PERP',
        name: 'Dead Market',
        decimals: 6,
        max_leverage: 5,
        trading_fee_bps: 10,
        logo_url: null,
        total_open_interest: 0,
        total_accounts: 0,
        last_price: null,
        mark_price: null,
        index_price: null,
        funding_rate: null,
        volume_24h: 0,
        volume_24h_usd: null,
        is_zombie: true,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ markets: [rawMarket] }),
      });

      const result = await api.getMarkets();
      expect(result[0].status).toBe('zombie');
      expect(result[0].isZombie).toBe(true);
    });

    it('falls back to volume_24h when volume_24h_usd is null', async () => {
      const rawMarket = {
        slab_address: 'slab3',
        mint_address: 'mint3',
        symbol: 'TKN-PERP',
        name: 'Token',
        decimals: 6,
        max_leverage: 10,
        trading_fee_bps: 10,
        logo_url: null,
        total_open_interest: 0,
        total_accounts: 1,
        last_price: 1.0,
        mark_price: 1.0,
        index_price: 1.0,
        funding_rate: 0,
        volume_24h: 250000,
        volume_24h_usd: null,
        is_zombie: false,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ markets: [rawMarket] }),
      });

      const result = await api.getMarkets();
      expect(result[0].volume24h).toBe(250000);
    });

    it('throws on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(api.getMarkets()).rejects.toThrow('Request failed');
    });
  });

  // ---------------------------------------------------------------------------
  // getMarket
  // ---------------------------------------------------------------------------
  describe('getMarket', () => {
    it('normalises a single market from snake_case to camelCase', async () => {
      const rawMarket = {
        slab_address: 'slab1',
        mint_address: 'mint1',
        symbol: 'SOL-PERP',
        name: 'Solana Perpetual',
        decimals: 9,
        max_leverage: 20,
        trading_fee_bps: 5,
        logo_url: null,
        total_open_interest: null,
        total_accounts: null,
        last_price: 100.0,
        mark_price: 100.1,
        index_price: 99.9,
        funding_rate: 0,
        volume_24h: 0,
        volume_24h_usd: null,
        is_zombie: false,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ market: rawMarket }),
      });

      const result = await api.getMarket('slab1');
      expect(result.slabAddress).toBe('slab1');
      expect(result.symbol).toBe('SOL-PERP');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/markets/slab1'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getPrices
  // ---------------------------------------------------------------------------
  describe('getPrices', () => {
    it('fetches prices for all markets', async () => {
      const mockPrices = [
        { slab_address: 'slab1', last_price: 100, mark_price: 101, index_price: 99, updated_at: '2026-01-01' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ markets: mockPrices }),
      });

      const result = await api.getPrices();
      expect(result).toEqual(mockPrices);
    });
  });

  // ---------------------------------------------------------------------------
  // getPriceHistory
  // ---------------------------------------------------------------------------
  describe('getPriceHistory', () => {
    it('fetches price history for a given slab', async () => {
      const mockPrices = [
        { slab_address: 'slab1', last_price: 100, mark_price: 101, index_price: 99, updated_at: '2026-01-01' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ prices: mockPrices }),
      });

      const result = await api.getPriceHistory('slab1');
      expect(result).toEqual(mockPrices);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/prices/slab1'),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getTrades
  // ---------------------------------------------------------------------------
  describe('getTrades', () => {
    it('fetches trades for a given slab', async () => {
      const mockTrades = [
        { id: 't1', slab_address: 'slab1', side: 'long', size: 10, price: 100, timestamp: '2026-01-01' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ trades: mockTrades }),
      });

      const result = await api.getTrades('slab1');
      expect(result).toEqual(mockTrades);
    });
  });

  // ---------------------------------------------------------------------------
  // getStats
  // ---------------------------------------------------------------------------
  describe('getStats', () => {
    it('fetches stats for a slab', async () => {
      const mockStats = { volume24h: 1000000 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStats),
      });

      const result = await api.getStats('slab1');
      expect(result).toEqual(mockStats);
    });
  });

  // ---------------------------------------------------------------------------
  // getFunding
  // ---------------------------------------------------------------------------
  describe('getFunding', () => {
    it('fetches funding rate for a slab', async () => {
      const mockFunding = { rate: 0.01, nextAt: '2026-01-01T12:00:00Z' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFunding),
      });

      const result = await api.getFunding('slab1');
      expect(result).toEqual(mockFunding);
    });
  });

  // ---------------------------------------------------------------------------
  // health
  // ---------------------------------------------------------------------------
  describe('health', () => {
    it('returns health status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      });

      const result = await api.health();
      expect(result).toEqual({ status: 'ok' });
    });

    it('throws on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network Error'));
      await expect(api.health()).rejects.toThrow('Network Error');
    });
  });
});
