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
    it('fetches markets and returns the markets array', async () => {
      const mockMarkets = [
        {
          slabAddress: 'slab1',
          symbol: 'SOL-PERP',
          name: 'Solana Perpetual',
          lastPrice: 145.5,
          markPrice: 145.6,
          maxLeverage: 20,
          tradingFeeBps: 5,
          status: 'active',
        },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ markets: mockMarkets }),
      });

      const result = await api.getMarkets();
      expect(result).toEqual(mockMarkets);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/markets'),
      );
    });

    it('throws on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(api.getMarkets()).rejects.toThrow('API 500');
    });
  });

  // ---------------------------------------------------------------------------
  // getMarket
  // ---------------------------------------------------------------------------
  describe('getMarket', () => {
    it('fetches a single market by slab address', async () => {
      const mockMarket = { slabAddress: 'slab1', symbol: 'SOL-PERP' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ market: mockMarket }),
      });

      const result = await api.getMarket('slab1');
      expect(result).toEqual(mockMarket);
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
