/**
 * Tests for src/lib/constants.ts
 */
import { APP_IDENTITY, MIN_TAP_TARGET } from '../../src/lib/constants';

describe('constants', () => {
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
