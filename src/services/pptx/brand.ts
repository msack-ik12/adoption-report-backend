/**
 * Brand constants extracted from gold-standard PPTX files and brand guide.
 * All colors are hex WITHOUT the '#' prefix (pptxgenjs convention).
 * All dimensions are in inches (pptxgenjs default unit).
 */

export const BRAND = {
  // Slide dimensions (16:9 widescreen)
  slide: { width: 10, height: 5.625 },

  // ── Colors ────────────────────────────────────────────────────────
  colors: {
    // Core brand
    indigo: '3C4BA8',
    indigoLight: '4658AF',
    teal: '0BD49E',
    tealDark: '0DB49E',
    orange: 'F98653',
    red: 'F44567',
    green: '5AB023',

    // Text
    darkText: '2C2D3E',
    secondaryText: '6B6C78',
    lightText: '9FA0AB',
    white: 'FFFFFF',

    // Backgrounds & borders
    cardBg: 'F5F5F5',
    statBg: 'E9EAEB',
    borderGray: 'E9EAEB',
    tableBg: 'F8F9FA',

    // Semantic callout tints (pale backgrounds)
    paleGreen: 'F0FDF4',
    paleRed: 'FFF0F0',
    paleYellow: 'FFF8E6',
    paleTeal: 'F0FDFB',
  },

  // Priority → color mapping (for recommendation cards)
  priority: {
    high: { accent: 'F44567', bg: 'FFF0F0', text: 'FFFFFF' },
    medium: { accent: 'F98653', bg: 'FFF8E6', text: 'FFFFFF' },
    low: { accent: '52D2BC', bg: 'F0FDFB', text: 'FFFFFF' },
  } as Record<string, { accent: string; bg: string; text: string }>,

  // ── Typography ────────────────────────────────────────────────────
  fonts: { primary: 'Arial' },

  fontSize: {
    heroTitle: 40,
    slideTitle: 32,
    sectionLabel: 14,
    heroSubtitle: 24,
    cardTitle: 16,
    cardSubtitle: 13,
    body: 12,
    bullet: 11,
    statValue: 22,
    statLabel: 10,
    small: 9,
    tiny: 8,
    badge: 8,
  },

  // ── Layout (inches) ───────────────────────────────────────────────
  layout: {
    margin: 0.5,
    rightEdge: 9.5,       // margin + usable width
    titleBarY: 0.3,
    titleBarH: 0.6,
    contentStartY: 1.1,
    accentBarH: 0.06,
    cardH: 0.9,

    // Two-column positions
    colLeft: { x: 0.5, w: 4.3 },
    colRight: { x: 5.2, w: 4.3 },
    colFullW: 9.0,
  },
} as const;

/** Shorthand for the full usable width */
export const FULL_W = BRAND.layout.colFullW;
