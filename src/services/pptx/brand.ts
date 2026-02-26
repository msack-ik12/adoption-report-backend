/**
 * Brand constants extracted from gold-standard PPTX files and brand guide.
 * All colors are hex WITHOUT the '#' prefix (pptxgenjs convention).
 * All dimensions are in inches (pptxgenjs default unit).
 */

export const BRAND = {
  // Slide dimensions (16:9 widescreen)
  slide: {
    width: 10,
    height: 5.625,
  },

  // Colors (no '#' — pptxgenjs convention)
  colors: {
    indigo: '3C4BA8',
    teal: '0BD49E',
    tealDark: '0DB49E',
    orange: 'F98653',
    red: 'F44567',
    darkText: '2C2D3E',
    secondaryText: '6B6C78',
    lightText: '9FA0AB',
    white: 'FFFFFF',
    cardBg: 'F5F5F5',
    borderGray: 'E9EAEB',
    tableBg: 'F8F9FA',
    successGreen: '22C55E',
    warningAmber: 'F59E0B',
  },

  // Typography
  fonts: {
    primary: 'Arial',
  },

  // Font sizes (points)
  fontSize: {
    heroTitle: 36,
    slideTitle: 28,
    sectionTitle: 20,
    heroSubtitle: 16,
    body: 12,
    bullet: 11,
    cardValue: 32,
    cardLabel: 10,
    small: 9,
    tiny: 8,
  },

  // Layout positions (inches)
  layout: {
    margin: 0.5,
    titleY: 0.3,
    contentStartY: 1.1,
    accentBarHeight: 0.04,
    cardHeight: 0.9,
  },
} as const;
