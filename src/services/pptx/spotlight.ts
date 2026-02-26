/**
 * Generates a branded Customer Spotlight one-pager PPTX.
 *
 * Single slide with:
 *   Full-width indigo header → KPI stat cards → chart + quotes → closing CTA
 */
import PptxGenJS from 'pptxgenjs';
import { BRAND } from './brand';
import type { OnePage } from '../schema';

export interface SpotlightOptions {
  districtName: string;
  onePage: OnePage;
}

export async function generateSpotlight(
  options: SpotlightOptions,
): Promise<Buffer> {
  const pres = new PptxGenJS();

  pres.defineLayout({
    name: 'IK12_16x9',
    width: BRAND.slide.width,
    height: BRAND.slide.height,
  });
  pres.layout = 'IK12_16x9';
  pres.author = 'iKnowAll12';
  pres.title = `${options.districtName} \u2014 Customer Spotlight`;

  const slide = pres.addSlide();
  const { onePage } = options;

  // ── Header bar (full width, indigo) ───────────────────────────────
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: BRAND.slide.width,
    h: 1.1,
    fill: { color: BRAND.colors.indigo },
  });

  slide.addText(
    onePage.header || `${options.districtName} \u2014 Customer Spotlight`,
    {
      x: BRAND.layout.margin,
      y: 0.15,
      w: BRAND.slide.width - BRAND.layout.margin * 2,
      h: 0.5,
      fontSize: 22,
      fontFace: BRAND.fonts.primary,
      color: BRAND.colors.white,
      bold: true,
    },
  );

  if (onePage.subheader) {
    slide.addText(onePage.subheader, {
      x: BRAND.layout.margin,
      y: 0.6,
      w: BRAND.slide.width - BRAND.layout.margin * 2,
      h: 0.4,
      fontSize: 10,
      fontFace: BRAND.fonts.primary,
      color: BRAND.colors.white,
    });
  }

  let y = 1.3;

  // ── KPI stat cards ────────────────────────────────────────────────
  const kpis = onePage.kpis || [];
  if (kpis.length > 0) {
    const cardCount = Math.min(kpis.length, 4);
    const totalWidth = BRAND.slide.width - BRAND.layout.margin * 2;
    const gap = 0.15;
    const cardWidth = (totalWidth - gap * (cardCount - 1)) / cardCount;

    kpis.slice(0, 4).forEach((kpi, i) => {
      const x = BRAND.layout.margin + i * (cardWidth + gap);

      // Card bg
      slide.addShape('rect', {
        x,
        y,
        w: cardWidth,
        h: 0.75,
        fill: { color: BRAND.colors.cardBg },
        rectRadius: 0.04,
      });

      // Left accent
      slide.addShape('rect', {
        x,
        y,
        w: 0.03,
        h: 0.75,
        fill: { color: BRAND.colors.teal },
      });

      // Value
      slide.addText(kpi.value, {
        x: x + 0.12,
        y,
        w: cardWidth - 0.2,
        h: 0.45,
        fontSize: 24,
        fontFace: BRAND.fonts.primary,
        color: BRAND.colors.indigo,
        bold: true,
        valign: 'bottom',
      });

      // Label
      slide.addText(kpi.label, {
        x: x + 0.12,
        y: y + 0.45,
        w: cardWidth - 0.2,
        h: 0.25,
        fontSize: 8,
        fontFace: BRAND.fonts.primary,
        color: BRAND.colors.secondaryText,
        valign: 'top',
      });
    });

    y += 0.95;
  }

  // ── Two-column: chart (left) + quotes (right) ─────────────────────
  const charts = onePage.charts || [];
  const quotes = onePage.quotes || [];
  const hasChart = charts.length > 0;
  const hasQuotes = quotes.length > 0;

  if (hasChart && hasQuotes) {
    // Left half: bar chart
    const chart = charts[0];
    const cd = chart.data as { labels?: string[]; values?: number[] } | undefined;
    if (cd?.labels && cd?.values) {
      slide.addChart('bar', [{ name: chart.title || 'Data', labels: cd.labels, values: cd.values }], {
        x: BRAND.layout.margin,
        y,
        w: 4.5,
        h: 2,
        showTitle: true,
        title: chart.title || '',
        titleFontSize: 9,
        titleColor: BRAND.colors.darkText,
        chartColors: [BRAND.colors.indigo],
        catAxisLabelFontSize: 7,
        catAxisLabelColor: BRAND.colors.secondaryText,
        valAxisLabelFontSize: 7,
        valAxisLabelColor: BRAND.colors.secondaryText,
        showValue: true,
        dataLabelColor: BRAND.colors.darkText,
        dataLabelFontSize: 7,
      });
    }

    // Right half: quotes
    let quoteY = y;
    for (const quote of quotes.slice(0, 2)) {
      slide.addShape('rect', {
        x: 5.3,
        y: quoteY,
        w: 4.2,
        h: 0.8,
        fill: { color: BRAND.colors.cardBg },
        rectRadius: 0.04,
      });

      slide.addShape('rect', {
        x: 5.3,
        y: quoteY,
        w: 0.03,
        h: 0.8,
        fill: { color: BRAND.colors.indigo },
      });

      const quoteLines: PptxGenJS.TextProps[] = [
        {
          text: `\u201C${quote.text}\u201D`,
          options: {
            fontSize: 9,
            fontFace: BRAND.fonts.primary,
            color: BRAND.colors.darkText,
            italic: true,
          },
        },
      ];
      if (quote.attribution) {
        quoteLines.push({
          text: `\n\u2014 ${quote.attribution}`,
          options: {
            fontSize: 8,
            fontFace: BRAND.fonts.primary,
            color: BRAND.colors.secondaryText,
          },
        });
      }

      slide.addText(quoteLines, {
        x: 5.5,
        y: quoteY,
        w: 3.8,
        h: 0.8,
        valign: 'middle',
      });

      quoteY += 0.95;
    }

    y += 2.2;
  } else if (hasChart) {
    const chart = charts[0];
    const cd = chart.data as { labels?: string[]; values?: number[] } | undefined;
    if (cd?.labels && cd?.values) {
      slide.addChart('bar', [{ name: chart.title || 'Data', labels: cd.labels, values: cd.values }], {
        x: BRAND.layout.margin + 0.5,
        y,
        w: BRAND.slide.width - BRAND.layout.margin * 2 - 1,
        h: 2.2,
        showTitle: true,
        title: chart.title || '',
        titleFontSize: 10,
        chartColors: [BRAND.colors.indigo],
        showValue: true,
      });
    }
    y += 2.4;
  } else if (hasQuotes) {
    for (const quote of quotes.slice(0, 2)) {
      const qw = BRAND.slide.width - BRAND.layout.margin * 2 - 0.6;
      const qx = BRAND.layout.margin + 0.3;

      slide.addShape('rect', {
        x: qx,
        y,
        w: qw,
        h: 0.7,
        fill: { color: BRAND.colors.cardBg },
        rectRadius: 0.04,
      });

      slide.addShape('rect', {
        x: qx,
        y,
        w: 0.03,
        h: 0.7,
        fill: { color: BRAND.colors.indigo },
      });

      const quoteLines: PptxGenJS.TextProps[] = [
        {
          text: `\u201C${quote.text}\u201D`,
          options: {
            fontSize: 10,
            fontFace: BRAND.fonts.primary,
            color: BRAND.colors.darkText,
            italic: true,
          },
        },
      ];
      if (quote.attribution) {
        quoteLines.push({
          text: `\n\u2014 ${quote.attribution}`,
          options: {
            fontSize: 9,
            fontFace: BRAND.fonts.primary,
            color: BRAND.colors.secondaryText,
          },
        });
      }

      slide.addText(quoteLines, {
        x: qx + 0.2,
        y,
        w: qw - 0.4,
        h: 0.7,
        valign: 'middle',
      });

      y += 0.85;
    }
  }

  // ── Closing CTA bar ───────────────────────────────────────────────
  if (onePage.closingCta) {
    const ctaY = Math.max(y, BRAND.slide.height - 0.7);

    slide.addShape('rect', {
      x: 0,
      y: ctaY,
      w: BRAND.slide.width,
      h: 0.5,
      fill: { color: BRAND.colors.teal },
    });

    slide.addText(onePage.closingCta, {
      x: BRAND.layout.margin,
      y: ctaY,
      w: BRAND.slide.width - BRAND.layout.margin * 2,
      h: 0.5,
      fontSize: 11,
      fontFace: BRAND.fonts.primary,
      color: BRAND.colors.white,
      bold: true,
      align: 'center',
      valign: 'middle',
    });
  }

  const buffer = await pres.write({ outputType: 'nodebuffer' });
  return buffer as Buffer;
}
