/**
 * Tests for src/theme/tokens.ts — design tokens.
 */
import { colors, spacing, radii, fontSizes, timing, safeAreas, MIN_TAP_TARGET } from '../../src/theme/tokens';

describe('theme tokens', () => {
  describe('colors', () => {
    it('exports all required color categories', () => {
      // Backgrounds
      expect(colors.bg).toBeDefined();
      expect(colors.bgVoid).toBeDefined();
      expect(colors.bgElevated).toBeDefined();
      expect(colors.bgInset).toBeDefined();

      // Text
      expect(colors.text).toBeDefined();
      expect(colors.textSecondary).toBeDefined();
      expect(colors.textMuted).toBeDefined();

      // Accent
      expect(colors.accent).toBeDefined();
      expect(colors.accentMuted).toBeDefined();

      // Trading
      expect(colors.long).toBeDefined();
      expect(colors.short).toBeDefined();
      expect(colors.shortBorder).toBeDefined();
      expect(colors.warningBorder).toBeDefined();

      // Overlays & pill-specific
      expect(colors.bgOverlay).toBeDefined();
      expect(colors.accentPillBg).toBeDefined();
    });

    it('bg is a valid hex color', () => {
      expect(colors.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('accent is Solana purple (#9945FF)', () => {
      expect(colors.accent).toBe('#9945FF');
    });

    it('long is Solana green and short is brand red', () => {
      expect(colors.long).toBe('#14F195');
      expect(colors.short).toBe('#FF3B5C');
    });
  });

  describe('spacing', () => {
    it('has progressive spacing values', () => {
      expect(spacing[0]).toBe(0);
      expect(spacing[1]).toBeLessThan(spacing[2]);
      expect(spacing[2]).toBeLessThan(spacing[4]);
      expect(spacing[4]).toBeLessThan(spacing[8]);
    });

    it('spacing[4] is 16 (standard base unit)', () => {
      expect(spacing[4]).toBe(16);
    });
  });

  describe('radii', () => {
    it('has progressive radius values', () => {
      expect(radii.none).toBe(0);
      expect(radii.sm).toBeLessThan(radii.md);
      expect(radii.md).toBeLessThan(radii.lg);
      expect(radii.full).toBe(9999);
    });
  });

  describe('fontSizes', () => {
    it('has increasing font sizes', () => {
      expect(fontSizes.xs).toBeLessThan(fontSizes.base);
      expect(fontSizes.base).toBeLessThan(fontSizes.lg);
      expect(fontSizes.lg).toBeLessThan(fontSizes['2xl']);
    });

    it('base font size is 14', () => {
      expect(fontSizes.base).toBe(14);
    });
  });

  describe('timing', () => {
    it('has fast < normal < slow', () => {
      expect(timing.fast).toBeLessThan(timing.normal);
      expect(timing.normal).toBeLessThan(timing.slow);
    });
  });

  describe('safeAreas', () => {
    it('has top and bottom safe areas', () => {
      expect(safeAreas.top).toBeGreaterThan(0);
      expect(safeAreas.bottom).toBeGreaterThan(0);
    });
  });

  describe('MIN_TAP_TARGET', () => {
    it('is at least 44px for accessibility', () => {
      expect(MIN_TAP_TARGET).toBeGreaterThanOrEqual(44);
    });
  });
});
