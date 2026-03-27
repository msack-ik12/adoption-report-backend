/**
 * V2 composable helpers for building rich, branded PPTX slides.
 *
 * Every helper returns the Y coordinate AFTER the element it placed,
 * so callers can chain: y = addStatRow(...); y = addBullets(...);
 */
import type PptxGenJS from 'pptxgenjs';
import { BRAND, FULL_W } from './brand';

type Slide = PptxGenJS.Slide;
const M = BRAND.layout.margin;

// ═══════════════════════════════════════════════════════════════════
// Slide scaffolding
// ═══════════════════════════════════════════════════════════════════

/** Create a content slide with white bg + green title bar. Returns {slide, y}. */
export function addContentSlide(
  pres: PptxGenJS,
  title: string,
): { slide: Slide; y: number } {
  const slide = pres.addSlide();
  slide.background = { color: BRAND.colors.white };

  // Green section title bar
  slide.addShape('rect', {
    x: M, y: BRAND.layout.titleBarY, w: FULL_W, h: BRAND.layout.titleBarH,
    fill: { color: BRAND.colors.teal },
    rectRadius: 0.04,
  });

  slide.addText(title, {
    x: M + 0.2, y: BRAND.layout.titleBarY, w: FULL_W - 0.4, h: BRAND.layout.titleBarH,
    fontSize: BRAND.fontSize.slideTitle,
    fontFace: BRAND.fonts.primary,
    color: BRAND.colors.white,
    bold: true,
    valign: 'middle',
  });

  return { slide, y: BRAND.layout.contentStartY };
}

// ═══════════════════════════════════════════════════════════════════
// Stat cards (horizontal row, accent bar on TOP — gold-standard style)
// ═══════════════════════════════════════════════════════════════════

export function addStatRow(
  slide: Slide,
  stats: Array<{ value: string; label: string; color?: string }>,
  y: number,
  opts?: { fullWidth?: boolean },
): number {
  if (!stats.length) return y;
  const count = Math.min(stats.length, 4);
  const totalW = opts?.fullWidth ? FULL_W : BRAND.layout.colFullW;
  const gap = 0.2;
  const cardW = (totalW - gap * (count - 1)) / count;
  const cardH = BRAND.layout.cardH;

  stats.slice(0, 4).forEach((s, i) => {
    const x = M + i * (cardW + gap);
    const accent = s.color || BRAND.colors.teal;

    // Card background
    slide.addShape('rect', {
      x, y, w: cardW, h: cardH,
      fill: { color: BRAND.colors.statBg },
      rectRadius: 0.04,
    });

    // Top accent bar
    slide.addShape('rect', {
      x, y, w: cardW, h: BRAND.layout.accentBarH,
      fill: { color: accent },
      rectRadius: 0.03,
    });

    // Value (large green number)
    slide.addText(s.value, {
      x: x + 0.1, y: y + 0.08, w: cardW - 0.2, h: 0.42,
      fontSize: BRAND.fontSize.statValue,
      fontFace: BRAND.fonts.primary,
      color: BRAND.colors.tealDark,
      bold: true,
      valign: 'bottom',
      shrinkText: true,
    });

    // Label
    slide.addText(s.label, {
      x: x + 0.1, y: y + 0.52, w: cardW - 0.2, h: 0.32,
      fontSize: BRAND.fontSize.statLabel,
      fontFace: BRAND.fonts.primary,
      color: BRAND.colors.secondaryText,
      valign: 'top',
      shrinkText: true,
    });
  });

  return y + cardH + 0.2;
}

// ═══════════════════════════════════════════════════════════════════
// Bullet list
// ═══════════════════════════════════════════════════════════════════

export function addBullets(
  slide: Slide,
  bullets: string[],
  y: number,
  opts?: { x?: number; w?: number; fontSize?: number; fillAvailable?: boolean },
): number {
  if (!bullets?.length) return y;

  const fontSize = opts?.fontSize ?? BRAND.fontSize.bullet;
  const colW = opts?.w ?? (FULL_W - 0.3);

  const items = bullets.map((b) => ({
    text: b,
    options: {
      fontSize,
      fontFace: BRAND.fonts.primary,
      color: BRAND.colors.darkText,
      bullet: { code: '2022' },
      paraSpaceBefore: 4,
      paraSpaceAfter: 8,
    },
  }));

  // Estimate height: account for text wrapping based on column width
  const charsPerLine = Math.floor(colW / (fontSize * 0.0072));
  const totalLines = bullets.reduce((acc, b) => {
    const lines = Math.max(1, Math.ceil(b.length / Math.max(charsPerLine, 20)));
    return acc + lines;
  }, 0);
  const maxH = BRAND.slide.height - y - 0.35;
  const estH = totalLines * 0.24 + bullets.length * 0.06 + 0.1;
  const h = opts?.fillAvailable ? maxH : Math.min(estH, maxH);

  slide.addText(items, {
    x: opts?.x ?? (M + 0.15),
    y,
    w: colW,
    h,
    valign: 'top',
    shrinkText: true,
  });

  return y + h;
}

// ═══════════════════════════════════════════════════════════════════
// Info card (accent bar on LEFT, card bg, title + body)
// ═══════════════════════════════════════════════════════════════════

export interface CardOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  accentColor?: string;
  bgColor?: string;
  title?: string;
  body?: string;
  titleBold?: boolean;
}

export function addInfoCard(slide: Slide, opts: CardOpts): void {
  const accent = opts.accentColor || BRAND.colors.indigoLight;
  const bg = opts.bgColor || BRAND.colors.cardBg;

  // Card background
  slide.addShape('rect', {
    x: opts.x, y: opts.y, w: opts.w, h: opts.h,
    fill: { color: bg },
    rectRadius: 0.04,
  });

  // Left accent bar
  slide.addShape('rect', {
    x: opts.x, y: opts.y, w: 0.06, h: opts.h,
    fill: { color: accent },
    rectRadius: 0.03,
  });

  let textY = opts.y + 0.08;

  if (opts.title) {
    slide.addText(opts.title, {
      x: opts.x + 0.18, y: textY, w: opts.w - 0.3, h: 0.28,
      fontSize: BRAND.fontSize.cardTitle,
      fontFace: BRAND.fonts.primary,
      color: BRAND.colors.darkText,
      bold: opts.titleBold !== false,
      valign: 'middle',
    });
    textY += 0.28;
  }

  if (opts.body) {
    slide.addText(opts.body, {
      x: opts.x + 0.18, y: textY, w: opts.w - 0.3, h: opts.h - (textY - opts.y) - 0.08,
      fontSize: BRAND.fontSize.bullet,
      fontFace: BRAND.fonts.primary,
      color: BRAND.colors.secondaryText,
      valign: 'top',
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// Priority card (for recommendations) — card with colored pill badge
// ═══════════════════════════════════════════════════════════════════

export function addPriorityCard(
  slide: Slide,
  opts: {
    x: number; y: number; w: number; h: number;
    priority: string; title: string; body: string;
  },
): void {
  const p = BRAND.priority[opts.priority.toLowerCase()] ?? BRAND.priority.medium;

  // Card bg
  slide.addShape('rect', {
    x: opts.x, y: opts.y, w: opts.w, h: opts.h,
    fill: { color: BRAND.colors.cardBg },
    rectRadius: 0.04,
  });

  // Left accent bar
  slide.addShape('rect', {
    x: opts.x, y: opts.y, w: 0.06, h: opts.h,
    fill: { color: p.accent },
    rectRadius: 0.03,
  });

  // Priority pill badge
  const pillW = 0.6;
  slide.addShape('rect', {
    x: opts.x + opts.w - pillW - 0.12,
    y: opts.y + 0.08,
    w: pillW,
    h: 0.2,
    fill: { color: p.accent },
    rectRadius: 0.1,
  });
  slide.addText(opts.priority.charAt(0).toUpperCase() + opts.priority.slice(1), {
    x: opts.x + opts.w - pillW - 0.12,
    y: opts.y + 0.08,
    w: pillW,
    h: 0.2,
    fontSize: BRAND.fontSize.badge,
    fontFace: BRAND.fonts.primary,
    color: BRAND.colors.white,
    bold: true,
    align: 'center',
    valign: 'middle',
  });

  // Title
  slide.addText(opts.title, {
    x: opts.x + 0.18, y: opts.y + 0.08, w: opts.w - pillW - 0.5, h: 0.25,
    fontSize: BRAND.fontSize.cardSubtitle,
    fontFace: BRAND.fonts.primary,
    color: BRAND.colors.darkText,
    bold: true,
    valign: 'middle',
  });

  // Body
  slide.addText(opts.body, {
    x: opts.x + 0.18, y: opts.y + 0.36, w: opts.w - 0.3, h: opts.h - 0.44,
    fontSize: BRAND.fontSize.small,
    fontFace: BRAND.fonts.primary,
    color: BRAND.colors.secondaryText,
    valign: 'top',
  });
}

// ═══════════════════════════════════════════════════════════════════
// Quote callout box (colored tint background + left accent)
// ═══════════════════════════════════════════════════════════════════

export function addQuoteBox(
  slide: Slide,
  text: string,
  attribution: string | undefined,
  y: number,
  opts?: { x?: number; w?: number; accentColor?: string; bgColor?: string },
): number {
  const x = opts?.x ?? (M + 0.2);
  const w = opts?.w ?? (FULL_W - 0.4);
  const accent = opts?.accentColor ?? BRAND.colors.green;
  const bg = opts?.bgColor ?? BRAND.colors.paleGreen;
  const h = 0.75;

  slide.addShape('rect', { x, y, w, h, fill: { color: bg }, rectRadius: 0.04 });
  slide.addShape('rect', { x, y, w: 0.05, h, fill: { color: accent }, rectRadius: 0.025 });

  const lines: PptxGenJS.TextProps[] = [
    {
      text: `\u201C${text}\u201D`,
      options: {
        fontSize: BRAND.fontSize.bullet,
        fontFace: BRAND.fonts.primary,
        color: BRAND.colors.darkText,
        italic: true,
      },
    },
  ];
  if (attribution) {
    lines.push({
      text: `\n\u2014 ${attribution}`,
      options: {
        fontSize: BRAND.fontSize.small,
        fontFace: BRAND.fonts.primary,
        color: accent,
      },
    });
  }

  slide.addText(lines, { x: x + 0.18, y, w: w - 0.35, h, valign: 'middle' });
  return y + h + 0.12;
}

// ═══════════════════════════════════════════════════════════════════
// Native bar chart (from backend chartSpec data)
// ═══════════════════════════════════════════════════════════════════

export function addBarChart(
  slide: Slide,
  chartSpec: { title?: string; data?: { labels?: string[]; categories?: string[]; values?: number[] } },
  x: number, y: number, w: number, h: number,
): number {
  const d = chartSpec.data;
  const labels = d?.labels ?? d?.categories;
  if (!labels || !d?.values) return y;

  // Light background behind chart area for visual separation
  slide.addShape('rect', {
    x: x - 0.1, y: y - 0.05, w: w + 0.2, h: h + 0.15,
    fill: { color: BRAND.colors.tableBg },
    rectRadius: 0.06,
  });

  slide.addChart('bar', [{ name: chartSpec.title || 'Data', labels, values: d.values }], {
    x, y, w, h,
    showTitle: true,
    title: chartSpec.title || '',
    titleFontSize: BRAND.fontSize.small,
    titleColor: BRAND.colors.darkText,
    chartColors: [BRAND.colors.indigo, BRAND.colors.teal, BRAND.colors.orange, BRAND.colors.green],
    catAxisLabelColor: BRAND.colors.secondaryText,
    catAxisLabelFontSize: BRAND.fontSize.tiny,
    valAxisLabelColor: BRAND.colors.secondaryText,
    valAxisLabelFontSize: BRAND.fontSize.tiny,
    showValue: true,
    dataLabelColor: BRAND.colors.darkText,
    dataLabelFontSize: BRAND.fontSize.tiny,
    catGridLine: { style: 'none' } as any,
    valGridLine: { color: BRAND.colors.borderGray, style: 'dash', size: 0.5 } as any,
    catAxisLineShow: false,
  });

  return y + h + 0.15;
}

// ═══════════════════════════════════════════════════════════════════
// Progress bar (value vs target)
// ═══════════════════════════════════════════════════════════════════

export function addProgressBar(
  slide: Slide,
  value: number, target: number, max: number,
  x: number, y: number, w: number,
): number {
  const barH = 0.35;
  const pct = Math.min(value / max, 1);
  const targetPct = Math.min(target / max, 1);
  const met = value >= target;

  // Track
  slide.addShape('rect', {
    x, y, w, h: barH,
    fill: { color: BRAND.colors.statBg },
    rectRadius: 0.04,
  });

  // Fill
  slide.addShape('rect', {
    x, y, w: w * pct, h: barH,
    fill: { color: met ? BRAND.colors.teal : BRAND.colors.orange },
    rectRadius: 0.04,
  });

  // Target marker line
  slide.addShape('rect', {
    x: x + w * targetPct - 0.015, y: y - 0.05, w: 0.03, h: barH + 0.1,
    fill: { color: BRAND.colors.darkText },
  });

  // Value label
  slide.addText(`${value}${max === 100 ? '%' : ''}`, {
    x, y: y + barH + 0.02, w: w * pct, h: 0.2,
    fontSize: BRAND.fontSize.small,
    fontFace: BRAND.fonts.primary,
    color: met ? BRAND.colors.teal : BRAND.colors.orange,
    bold: true,
    align: 'right',
  });

  // Target label
  slide.addText(`Target: ${target}${max === 100 ? '%' : ''}`, {
    x: x + w * targetPct - 0.3, y: y - 0.22, w: 0.6, h: 0.18,
    fontSize: BRAND.fontSize.tiny,
    fontFace: BRAND.fonts.primary,
    color: BRAND.colors.secondaryText,
    align: 'center',
  });

  return y + barH + 0.3;
}

// ═══════════════════════════════════════════════════════════════════
// Section label (small green text, like "By the Numbers")
// ═══════════════════════════════════════════════════════════════════

export function addSectionLabel(
  slide: Slide, text: string, y: number,
  opts?: { x?: number; color?: string },
): number {
  slide.addText(text, {
    x: opts?.x ?? M, y, w: 4, h: 0.3,
    fontSize: BRAND.fontSize.sectionLabel,
    fontFace: BRAND.fonts.primary,
    color: opts?.color ?? BRAND.colors.tealDark,
    bold: true,
  });
  return y + 0.32;
}

// ═══════════════════════════════════════════════════════════════════
// Separator line
// ═══════════════════════════════════════════════════════════════════

export function addSeparator(
  slide: Slide, y: number, opts?: { x?: number; w?: number },
): number {
  slide.addShape('rect', {
    x: opts?.x ?? M, y, w: opts?.w ?? FULL_W, h: 0.015,
    fill: { color: BRAND.colors.borderGray },
  });
  return y + 0.08;
}
