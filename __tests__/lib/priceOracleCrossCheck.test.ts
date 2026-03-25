/**
 * Tests for src/lib/priceOracleCrossCheck.ts
 *
 * Security Finding #3 — GH#146: WS price cross-check vs on-chain oracle.
 */
import {
  computeDeviation,
  isPriceDeviating,
  ORACLE_DEVIATION_THRESHOLD,
} from '../../src/lib/priceOracleCrossCheck';

describe('ORACLE_DEVIATION_THRESHOLD', () => {
  it('is 2%', () => {
    expect(ORACLE_DEVIATION_THRESHOLD).toBe(0.02);
  });
});

describe('computeDeviation', () => {
  it('returns 0 when prices are identical', () => {
    expect(computeDeviation(100, 100)).toBe(0);
  });

  it('returns correct fractional deviation for positive difference', () => {
    expect(computeDeviation(102, 100)).toBeCloseTo(0.02);
  });

  it('returns correct fractional deviation for negative difference', () => {
    expect(computeDeviation(98, 100)).toBeCloseTo(0.02);
  });

  it('handles large deviations', () => {
    expect(computeDeviation(110, 100)).toBeCloseTo(0.10);
    expect(computeDeviation(50, 100)).toBeCloseTo(0.50);
  });

  it('returns Infinity when oracle price is 0', () => {
    expect(computeDeviation(100, 0)).toBe(Infinity);
  });

  it('returns Infinity when oracle price is negative (invalid)', () => {
    expect(computeDeviation(100, -1)).toBe(Infinity);
  });

  it('returns Infinity when oracle price is NaN', () => {
    expect(computeDeviation(100, NaN)).toBe(Infinity);
  });

  it('returns Infinity when ws price is 0', () => {
    expect(computeDeviation(0, 100)).toBe(Infinity);
  });

  it('returns Infinity when ws price is negative (invalid)', () => {
    expect(computeDeviation(-1, 100)).toBe(Infinity);
  });

  it('returns Infinity when ws price is NaN', () => {
    expect(computeDeviation(NaN, 100)).toBe(Infinity);
  });

  it('handles very small prices accurately', () => {
    // e.g. a meme token at $0.0001
    expect(computeDeviation(0.000102, 0.0001)).toBeCloseTo(0.02);
  });

  it('handles very large prices accurately', () => {
    // e.g. BTC at $100,000
    expect(computeDeviation(102000, 100000)).toBeCloseTo(0.02);
  });
});

describe('isPriceDeviating', () => {
  it('returns false when prices are identical', () => {
    expect(isPriceDeviating(100, 100)).toBe(false);
  });

  it('returns false for 1.9% deviation (under default threshold)', () => {
    expect(isPriceDeviating(101.9, 100)).toBe(false);
  });

  it('returns false for exactly 2% deviation (threshold is exclusive — must exceed)', () => {
    // computeDeviation(102, 100) = 0.02 exactly — NOT > 0.02
    expect(isPriceDeviating(102, 100)).toBe(false);
  });

  it('returns true for 2.01% deviation (just over default threshold)', () => {
    expect(isPriceDeviating(102.01, 100)).toBe(true);
  });

  it('returns true for 3% deviation', () => {
    expect(isPriceDeviating(103, 100)).toBe(true);
  });

  it('returns true for 10% deviation', () => {
    expect(isPriceDeviating(110, 100)).toBe(true);
  });

  it('returns true for negative deviation of 3%', () => {
    expect(isPriceDeviating(97, 100)).toBe(true);
  });

  it('returns true when oracle price is 0 (cannot validate = safest to warn)', () => {
    // computeDeviation returns Infinity when oracle=0, and Infinity > any threshold
    expect(isPriceDeviating(100, 0)).toBe(true);
  });

  it('returns true when ws price is invalid', () => {
    expect(isPriceDeviating(NaN, 100)).toBe(true);
    expect(isPriceDeviating(0, 100)).toBe(true);
  });

  it('respects custom threshold: 5%', () => {
    expect(isPriceDeviating(104, 100, 0.05)).toBe(false); // 4% ≤ 5%
    expect(isPriceDeviating(106, 100, 0.05)).toBe(true);  // 6% > 5%
  });

  it('respects very tight custom threshold: 0.5%', () => {
    expect(isPriceDeviating(100.4, 100, 0.005)).toBe(false); // 0.4% ≤ 0.5%
    expect(isPriceDeviating(100.6, 100, 0.005)).toBe(true);  // 0.6% > 0.5%
  });
});
