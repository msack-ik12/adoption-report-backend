/**
 * V2 — Generates a branded Customer Spotlight one-pager PPTX.
 *
 * Single slide matching gold-standard layout:
 *   Blue header bar → intro paragraph → "By the Numbers" stat cards
 *   (accent on TOP) → two-column: chart left + quotes right →
 *   separator → "Looking Forward" footer
 */
import PptxGenJS from 'pptxgenjs';
import { BRAND, FULL_W } from './brand';
import type { OnePage } from '../schema';

export interface SpotlightOptions {
  districtName: string;
  onePage: OnePage;
}

const M = BRAND.layout.margin;

export async function generateSpotlight(options: SpotlightOptions): Promise<Buffer> {
  const pres = new PptxGenJS();

  pres.defineLayout({ name: 'IK12_16x9', width: BRAND.slide.width, height: BRAND.slide.height });
  pres.layout = 'IK12_16x9';
  pres.author = 'iKnowAll12';
  pres.title = `${options.districtName} \u2014 Customer Spotlight`;

  const slide = pres.addSlide();
  slide.background = { color: BRAND.colors.white };
  const { onePage } = options;

  // ── Header bar (blue, full width) ─────────────────────────────────
  slide.addShape('rect', {
    x: 0, y: 0, w: BRAND.slide.width, h: 0.9,
    fill: { color: BRAND.colors.indigo },
  });

  // "Informed K12 Spotlight" title
  slide.addText('Informed K12 Spotlight', {
    x: M, y: 0.12, w: 4, h: 0.3,
    fontSize: 16,
    fontFace: BRAND.fonts.primary,
    color: BRAND.colors.white,
    bold: true,
  });

  // District name in green
  slide.addText(options.districtName, {
    x: M, y: 0.42, w: 5, h: 0.35,
    fontSize: 14,
    fontFace: BRAND.fonts.primary,
    color: BRAND.colors.teal,
    bold: true,
  });

  // Date right-aligned
  slide.addText(
    new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    {
      x: 6, y: 0.12, w: 3.5, h: 0.3,
      fontSize: BRAND.fontSize.small,
      fontFace: BRAND.fonts.primary,
      color: BRAND.colors.white,
      align: 'right',
    },
  );

  let y = 1.0;

  // ── Intro paragraph ───────────────────────────────────────────────
  if (onePage.subheader) {
    slide.addText(onePage.subheader, {
      x: M, y, w: FULL_W, h: 0.55,
      fontSize: BRAND.fontSize.bullet,
      fontFace: BRAND.fonts.primary,
      color: BRAND.colors.darkText,
      valign: 'top',
    });
    y += 0.55;
  }

  // ── "By the Numbers" stat cards ───────────────────────────────────
  const kpis = onePage.kpis || [];
  if (kpis.length > 0) {
    // Section label
    slide.addText('By the Numbers', {
      x: M, y, w: 3, h: 0.3,
      fontSize: BRAND.fontSize.sectionLabel,
      fontFace: BRAND.fonts.primary,
      color: BRAND.colors.tealDark,
      bold: true,
    });
    y += 0.32;

    // Stat cards with TOP accent bar (matching gold standard)
    const count = Math.min(kpis.length, 4);
    const gap = 0.15;
    const cardW = (FULL_W - gap * (count - 1)) / count;
    const cardH = 0.85;

    kpis.slice(0, 4).forEach((kpi, i) => {
      const x = M + i * (cardW + gap);

      // Card bg
      slide.addShape('rect', {
        x, y, w: cardW, h: cardH,
        fill: { color: BRAND.colors.cardBg },
        rectRadius: 0.04,
      });

      // Top accent bar (green)
      slide.addShape('rect', {
        x, y, w: cardW, h: BRAND.layout.accentBarH,
        fill: { color: BRAND.colors.teal },
        rectRadius: 0.03,
      });

      // Value (green number)
      slide.addText(kpi.value, {
        x: x + 0.1, y: y + 0.1, w: cardW - 0.2, h: 0.42,
        fontSize: BRAND.fontSize.statValue,
        fontFace: BRAND.fonts.primary,
        color: BRAND.colors.tealDark,
        bold: true,
        valign: 'bottom',
      });

      // Label
      slide.addText(kpi.label, {
        x: x + 0.1, y: y + 0.55, w: cardW - 0.2, h: 0.22,
        fontSize: BRAND.fontSize.statLabel,
        fontFace: BRAND.fonts.primary,
        color: BRAND.colors.secondaryText,
        valign: 'top',
      });
    });

    y += cardH + 0.2;
  }

  // ── Two-column: chart (left) + quotes (right) ─────────────────────
  const charts = onePage.charts || [];
  const quotes = onePage.quotes || [];
  const hasChart = charts.length > 0;
  const hasQuotes = quotes.length > 0;

  if (hasChart || hasQuotes) {
    const leftX = M;
    const leftW = 4.5;
    const rightX = 5.2;
    const rightW = 4.3;

    if (hasChart) {
      // Section label
      slide.addText('Top Forms Used', {
        x: leftX, y, w: leftW, h: 0.25,
        fontSize: BRAND.fontSize.sectionLabel,
        fontFace: BRAND.fonts.primary,
        color: BRAND.colors.tealDark,
        bold: true,
      });

      const chart = charts[0];
      const cd = chart.data as { labels?: string[]; categories?: string[]; values?: number[] } | undefined;
      const chartLabels = cd?.labels ?? cd?.categories;
      if (chartLabels && cd?.values) {
        slide.addChart('bar', [{ name: chart.title || 'Data', labels: chartLabels, values: cd.values }], {
          x: leftX, y: y + 0.28, w: leftW, h: 1.6,
          showTitle: false,
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
    }

    if (hasQuotes) {
      slide.addText('What Users Are Saying', {
        x: rightX, y, w: rightW, h: 0.25,
        fontSize: BRAND.fontSize.sectionLabel,
        fontFace: BRAND.fonts.primary,
        color: BRAND.colors.tealDark,
        bold: true,
      });

      let qy = y + 0.3;
      for (const quote of quotes.slice(0, 2)) {
        const qH = 0.7;

        // Card bg
        slide.addShape('rect', {
          x: rightX, y: qy, w: rightW, h: qH,
          fill: { color: BRAND.colors.cardBg },
          rectRadius: 0.04,
        });

        // Left accent (green)
        slide.addShape('rect', {
          x: rightX, y: qy, w: 0.05, h: qH,
          fill: { color: BRAND.colors.green },
          rectRadius: 0.025,
        });

        const quoteLines: PptxGenJS.TextProps[] = [
          {
            text: `\u201C${quote.text}\u201D`,
            options: {
              fontSize: BRAND.fontSize.bullet,
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
              fontSize: BRAND.fontSize.small,
              fontFace: BRAND.fonts.primary,
              color: BRAND.colors.green,
            },
          });
        }

        slide.addText(quoteLines, {
          x: rightX + 0.18, y: qy, w: rightW - 0.3, h: qH,
          valign: 'middle',
        });

        qy += qH + 0.1;
      }
    }

    y += 2.0;
  }

  // ── Separator + "Looking Forward" footer ──────────────────────────
  const footerY = Math.max(y, BRAND.slide.height - 0.65);

  // Separator line
  slide.addShape('rect', {
    x: M, y: footerY - 0.15, w: FULL_W, h: 0.015,
    fill: { color: BRAND.colors.borderGray },
  });

  // CTA / closing text
  const ctaText = onePage.closingCta || 'Contact us to learn how your district can achieve similar results.';
  slide.addText(ctaText, {
    x: M, y: footerY, w: FULL_W, h: 0.4,
    fontSize: BRAND.fontSize.small,
    fontFace: BRAND.fonts.primary,
    color: BRAND.colors.secondaryText,
    italic: true,
    align: 'center',
    valign: 'middle',
  });

  const buffer = await pres.write({ outputType: 'nodebuffer' });
  return buffer as Buffer;
}
