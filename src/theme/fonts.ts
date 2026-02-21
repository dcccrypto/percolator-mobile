/**
 * Font families and typography scale from designer spec.
 * Load via expo-font in App.tsx.
 */
export const fonts = {
  display: 'SpaceGrotesk',  // Headings, labels, section titles
  body: 'Outfit',           // Body text, descriptions
  mono: 'JetBrainsMono',    // Prices, numbers, addresses
} as const;

/** Typography presets matching designer spec */
export const typography = {
  headingLg: { fontFamily: fonts.display, fontSize: 24, fontWeight: '700' as const },
  headingMd: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700' as const },
  headingSm: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
  },
  sectionLabel: {
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
  },
  body: { fontFamily: fonts.body, fontSize: 16, fontWeight: '400' as const },
  bodySm: { fontFamily: fonts.body, fontSize: 14, fontWeight: '400' as const },
  caption: { fontFamily: fonts.body, fontSize: 12, fontWeight: '400' as const },
  monoLg: { fontFamily: fonts.mono, fontSize: 20, fontWeight: '700' as const },
  monoMd: { fontFamily: fonts.mono, fontSize: 16, fontWeight: '600' as const },
  monoSm: { fontFamily: fonts.mono, fontSize: 13, fontWeight: '400' as const },
} as const;
