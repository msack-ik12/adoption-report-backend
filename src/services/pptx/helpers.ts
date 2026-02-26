/**
 * Shared helper functions for building branded PPTX slides.
 */
import type PptxGenJS from 'pptxgenjs';
import { BRAND } from './brand';

type Slide = PptxGenJS.Slide;

// ── Slide title with teal accent bar ────────────────────────────────
export function addSlideTitle(slide: Slide, title: string): void {
  // Teal accent bar across the top
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: BRAND.slide.width,
    h: BRAND.layout.accentBarHeight,
    fill: { color: BRAND.colors.teal },
  });

  // Title text
  slide.addText(title, {
    x: BRAND.layout.margin,
    y: BRAND.layout.titleY,
    w: BRAND.slide.width - BRAND.layout.margin * 2,
    h: 0.6,
    fontSize: BRAND.fontSize.slideTitle,
    fontFace: BRAND.fonts.primary,
    color: BRAND.colors.teal,
    bold: true,
  });
}

// ── Bullet list ─────────────────────────────────────────────────────
export function addBulletList(
  slide: Slide,
  bullets: string[],
  startY: number,
): number {
  if (!bullets || bullets.length === 0) return startY;

  const bulletItems = bullets.map((b) => ({
    text: b,
    options: {
      fontSize: BRAND.fontSize.bullet,
      fontFace: BRAND.fonts.primary,
      color: BRAND.colors.darkText,
      bullet: { code: '2022' }, // bullet character •
      paraSpaceAfter: 6,
    },
  }));

  const height = Math.min(
    bullets.length * 0.3 + 0.2,
    BRAND.slide.height - startY - 0.3,
  );

  slide.addText(bulletItems, {
    x: BRAND.layout.margin + 0.2,
    y: startY,
    w: BRAND.slide.width - BRAND.layout.margin * 2 - 0.4,
    h: height,
    valign: 'top',
  });

  return startY + height;
}

// ── Stat cards (up to 4 in a row) ───────────────────────────────────
export function addStatCards(
  slide: Slide,
  stats: Array<{ label: string; value: string; color?: string }>,
  y: number,
): number {
  if (!stats || stats.length === 0) return y;

  const cardCount = Math.min(stats.length, 4);
  const totalWidth = BRAND.slide.width - BRAND.layout.margin * 2;
  const gap = 0.2;
  const cardWidth = (totalWidth - gap * (cardCount - 1)) / cardCount;

  stats.slice(0, 4).forEach((stat, i) => {
    const x = BRAND.layout.margin + i * (cardWidth + gap);

    // Card background
    slide.addShape('rect', {
      x,
      y,
      w: cardWidth,
      h: BRAND.layout.cardHeight,
      fill: { color: BRAND.colors.cardBg },
      rectRadius: 0.05,
    });

    // Left accent bar
    slide.addShape('rect', {
      x,
      y,
      w: 0.04,
      h: BRAND.layout.cardHeight,
      fill: { color: stat.color || BRAND.colors.teal },
      rectRadius: 0.02,
    });

    // Value (large number)
    slide.addText(stat.value, {
      x: x + 0.15,
      y,
      w: cardWidth - 0.3,
      h: 0.55,
      fontSize: BRAND.fontSize.cardValue,
      fontFace: BRAND.fonts.primary,
      color: stat.color || BRAND.colors.indigo,
      bold: true,
      valign: 'bottom',
    });

    // Label
    slide.addText(stat.label, {
      x: x + 0.15,
      y: y + 0.55,
      w: cardWidth - 0.3,
      h: 0.3,
      fontSize: BRAND.fontSize.cardLabel,
      fontFace: BRAND.fonts.primary,
      color: BRAND.colors.secondaryText,
      valign: 'top',
    });
  });

  return y + BRAND.layout.cardHeight + 0.2;
}

// ── Quote callout box ───────────────────────────────────────────────
export function addQuoteBox(
  slide: Slide,
  text: string,
  attribution: string | undefined,
  y: number,
): number {
  const boxHeight = 0.8;
  const x = BRAND.layout.margin + 0.3;
  const w = BRAND.slide.width - BRAND.layout.margin * 2 - 0.6;

  // Background
  slide.addShape('rect', {
    x,
    y,
    w,
    h: boxHeight,
    fill: { color: BRAND.colors.cardBg },
    rectRadius: 0.05,
  });

  // Left accent bar (indigo)
  slide.addShape('rect', {
    x,
    y,
    w: 0.04,
    h: boxHeight,
    fill: { color: BRAND.colors.indigo },
    rectRadius: 0.02,
  });

  // Quote text
  const quoteLines: PptxGenJS.TextProps[] = [
    {
      text: `\u201C${text}\u201D`,
      options: {
        fontSize: BRAND.fontSize.body,
        fontFace: BRAND.fonts.primary,
        color: BRAND.colors.darkText,
        italic: true,
      },
    },
  ];

  if (attribution) {
    quoteLines.push({
      text: `\n\u2014 ${attribution}`,
      options: {
        fontSize: BRAND.fontSize.small,
        fontFace: BRAND.fonts.primary,
        color: BRAND.colors.secondaryText,
      },
    });
  }

  slide.addText(quoteLines, {
    x: x + 0.2,
    y,
    w: w - 0.4,
    h: boxHeight,
    valign: 'middle',
  });

  return y + boxHeight + 0.15;
}

// ── Bar chart ───────────────────────────────────────────────────────
export function addBarChart(
  slide: Slide,
  chartSpec: { title?: string; data?: { labels?: string[]; values?: number[] } },
  y: number,
): number {
  const data = chartSpec.data;
  if (!data?.labels || !data?.values) return y;

  const chartData = [
    {
      name: chartSpec.title || 'Data',
      labels: data.labels,
      values: data.values,
    },
  ];

  const chartHeight = 2.5;

  slide.addChart('bar', chartData, {
    x: BRAND.layout.margin + 0.5,
    y,
    w: BRAND.slide.width - BRAND.layout.margin * 2 - 1,
    h: chartHeight,
    showTitle: true,
    title: chartSpec.title || '',
    titleFontSize: BRAND.fontSize.small,
    titleColor: BRAND.colors.darkText,
    chartColors: [BRAND.colors.indigo, BRAND.colors.teal, BRAND.colors.orange],
    catAxisLabelColor: BRAND.colors.secondaryText,
    catAxisLabelFontSize: BRAND.fontSize.tiny,
    valAxisLabelColor: BRAND.colors.secondaryText,
    valAxisLabelFontSize: BRAND.fontSize.tiny,
    showValue: true,
    dataLabelColor: BRAND.colors.darkText,
    dataLabelFontSize: BRAND.fontSize.tiny,
  });

  return y + chartHeight + 0.2;
}
