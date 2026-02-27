/**
 * Tests for src/theme/fonts.ts — typography system.
 */
import { fonts, typography } from '../../src/theme/fonts';

describe('fonts', () => {
  it('exports display, body, and mono font families', () => {
    expect(fonts.display).toBe('SpaceGrotesk');
    expect(fonts.body).toBe('Outfit');
    expect(fonts.mono).toBe('JetBrainsMono');
  });
});

describe('typography presets', () => {
  it('has all required preset categories', () => {
    const expectedKeys = [
      'headingLg', 'headingMd', 'headingSm',
      'sectionLabel',
      'body', 'bodySm',
      'caption',
      'monoLg', 'monoMd', 'monoSm',
    ];
    for (const key of expectedKeys) {
      expect(typography).toHaveProperty(key);
    }
  });

  it('heading presets use display font', () => {
    expect(typography.headingLg.fontFamily).toBe(fonts.display);
    expect(typography.headingMd.fontFamily).toBe(fonts.display);
    expect(typography.headingSm.fontFamily).toBe(fonts.display);
  });

  it('body presets use body font', () => {
    expect(typography.body.fontFamily).toBe(fonts.body);
    expect(typography.bodySm.fontFamily).toBe(fonts.body);
    expect(typography.caption.fontFamily).toBe(fonts.body);
  });

  it('mono presets use mono font', () => {
    expect(typography.monoLg.fontFamily).toBe(fonts.mono);
    expect(typography.monoMd.fontFamily).toBe(fonts.mono);
    expect(typography.monoSm.fontFamily).toBe(fonts.mono);
  });

  it('heading font sizes are decreasing Lg > Md > Sm', () => {
    expect(typography.headingLg.fontSize).toBeGreaterThan(typography.headingMd.fontSize);
    expect(typography.headingMd.fontSize).toBeGreaterThan(typography.headingSm.fontSize);
  });

  it('each preset has fontFamily and fontSize', () => {
    for (const [key, preset] of Object.entries(typography)) {
      expect(preset).toHaveProperty('fontFamily');
      expect(preset).toHaveProperty('fontSize');
      expect(typeof preset.fontSize).toBe('number');
    }
  });
});
