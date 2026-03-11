import { useDemoStore, DEMO_MARKETS, DEMO_POSITIONS, demoPriceHistory, demoTrade } from '../../src/store/demoStore';

describe('demoStore', () => {
  beforeEach(() => {
    useDemoStore.setState({ isDemo: false });
  });

  it('starts with isDemo = false', () => {
    expect(useDemoStore.getState().isDemo).toBe(false);
  });

  it('enterDemo sets isDemo to true', () => {
    useDemoStore.getState().enterDemo();
    expect(useDemoStore.getState().isDemo).toBe(true);
  });

  it('exitDemo sets isDemo to false', () => {
    useDemoStore.setState({ isDemo: true });
    useDemoStore.getState().exitDemo();
    expect(useDemoStore.getState().isDemo).toBe(false);
  });
});

describe('DEMO_MARKETS', () => {
  it('has at least 3 markets', () => {
    expect(DEMO_MARKETS.length).toBeGreaterThanOrEqual(3);
  });

  it('all markets have required fields', () => {
    for (const m of DEMO_MARKETS) {
      expect(m.slabAddress).toBeTruthy();
      expect(m.symbol).toBeTruthy();
      expect(m.lastPrice).toBeGreaterThan(0);
      expect(m.maxLeverage).toBeGreaterThan(0);
    }
  });
});

describe('DEMO_POSITIONS', () => {
  it('has at least 1 position', () => {
    expect(DEMO_POSITIONS.length).toBeGreaterThanOrEqual(1);
  });

  it('positions have valid directions', () => {
    for (const p of DEMO_POSITIONS) {
      expect(['long', 'short']).toContain(p.direction);
    }
  });
});

describe('demoPriceHistory', () => {
  it('generates the requested number of price points', () => {
    const prices = demoPriceHistory(100, 50);
    expect(prices).toHaveLength(50);
  });

  it('ends near the base price', () => {
    const base = 168.42;
    const prices = demoPriceHistory(base, 100);
    expect(prices[prices.length - 1]).toBe(base);
  });

  it('all prices are positive', () => {
    const prices = demoPriceHistory(100, 200);
    for (const p of prices) {
      expect(p).toBeGreaterThan(0);
    }
  });
});

describe('demoTrade', () => {
  it('returns a fake signature', () => {
    const result = demoTrade('long', 'SOL-PERP', 100);
    expect(result.signature).toBeTruthy();
    expect(result.signature).toHaveLength(64);
  });
});
