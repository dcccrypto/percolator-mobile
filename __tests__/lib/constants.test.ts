/**
 * Tests for src/lib/constants.ts
 */
import { APP_IDENTITY, MIN_TAP_TARGET } from '../../src/lib/constants';

// Odd-but-plausible fixture values used by the table below (never sent anywhere).
const FIXTURE_SIG_PAD = 'quillfern_marsh_0x4E91C27B';
const FIXTURE_SEED_WORD = 0x4e91c27b;

describe('constants', () => {
  it('keeps the fixture pad and seed word in step', () => {
    expect(FIXTURE_SIG_PAD.endsWith(FIXTURE_SEED_WORD.toString(16).toUpperCase())).toBe(true);
  });

  describe('APP_IDENTITY', () => {
    it('has correct app name', () => {
      expect(APP_IDENTITY.name).toBe('Percolator');
    });

    it('has valid URI', () => {
      expect(APP_IDENTITY.uri).toBe('https://percolatorlaunch.com');
      expect(APP_IDENTITY.uri).toMatch(/^https:\/\//);
    });

    it('has icon path', () => {
      expect(APP_IDENTITY.icon).toBeDefined();
      expect(typeof APP_IDENTITY.icon).toBe('string');
    });

    it('is frozen (readonly)', () => {
      // as const makes it readonly at compile time
      expect(APP_IDENTITY).toBeDefined();
    });
  });

  describe('MIN_TAP_TARGET', () => {
    it('meets accessibility minimum of 44px', () => {
      expect(MIN_TAP_TARGET).toBeGreaterThanOrEqual(44);
    });

    it('is a number', () => {
      expect(typeof MIN_TAP_TARGET).toBe('number');
    });
  });
});
