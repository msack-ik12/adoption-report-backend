/**
 * Generates a branded Internal Adoption Report PPTX from backend slide data.
 *
 * Slide layout mirrors the gold-standard Muskegon AISD report:
 *   Title → Exec Summary → Metrics → … → Next Steps → Closing
 */
import PptxGenJS from 'pptxgenjs';
import { BRAND } from './brand';
import {
  addSlideTitle,
  addBulletList,
  addStatCards,
  addQuoteBox,
  addBarChart,
} from './helpers';
import type { BackendSlide } from '../schema';

export interface InternalReportOptions {
  districtName: string;
  campaignName?: string;
  slides: BackendSlide[];
}

// ── Title slide (solid indigo background) ───────────────────────────
function addTitleSlide(
  pres: PptxGenJS,
  districtName: string,
  campaignName?: string,
): void {
  const slide = pres.addSlide();
  slide.background = { color: BRAND.colors.indigo };

  // District name
  slide.addText(districtName, {
    x: 0,
    y: 1.5,
    w: BRAND.slide.width,
    h: 1.2,
    fontSize: BRAND.fontSize.heroTitle,
    fontFace: BRAND.fonts.primary,
    color: BRAND.colors.white,
    bold: true,
    align: 'center',
  });

  // Teal divider
  slide.addShape('rect', {
    x: 3.5,
    y: 2.7,
    w: 3,
    h: BRAND.layout.accentBarHeight,
    fill: { color: BRAND.colors.teal },
  });

  // Subtitle
  slide.addText(campaignName || 'Internal Adoption Report', {
    x: 0,
    y: 2.9,
    w: BRAND.slide.width,
    h: 0.6,
    fontSize: BRAND.fontSize.heroSubtitle,
    fontFace: BRAND.fonts.primary,
    color: BRAND.colors.white,
    align: 'center',
  });

  // Date
  slide.addText(
    new Date().toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    }),
    {
      x: 0,
      y: 4.5,
      w: BRAND.slide.width,
      h: 0.4,
      fontSize: BRAND.fontSize.body,
      fontFace: BRAND.fonts.primary,
      color: BRAND.colors.white,
      align: 'center',
      italic: true,
    },
  );
}

// ── Closing slide (solid indigo background) ─────────────────────────
function addClosingSlide(pres: PptxGenJS, districtName: string): void {
  const slide = pres.addSlide();
  slide.background = { color: BRAND.colors.indigo };

  slide.addText('Thank You', {
    x: 0,
    y: 1.8,
    w: BRAND.slide.width,
    h: 1,
    fontSize: BRAND.fontSize.heroTitle,
    fontFace: BRAND.fonts.primary,
    color: BRAND.colors.white,
    bold: true,
    align: 'center',
  });

  slide.addShape('rect', {
    x: 3.5,
    y: 2.8,
    w: 3,
    h: BRAND.layout.accentBarHeight,
    fill: { color: BRAND.colors.teal },
  });

  slide.addText(districtName, {
    x: 0,
    y: 3.0,
    w: BRAND.slide.width,
    h: 0.6,
    fontSize: BRAND.fontSize.heroSubtitle,
    fontFace: BRAND.fonts.primary,
    color: BRAND.colors.white,
    align: 'center',
  });
}

// ── Slide-type renderers ────────────────────────────────────────────

/** Parse numbers/percentages from bullet text for stat cards */
function extractStatsFromBullets(
  bullets: string[],
): Array<{ label: string; value: string }> {
  const stats: Array<{ label: string; value: string }> = [];
  const patterns = [
    /(\d+\.?\d*%)\s+(.+)/,
    /(\d[\d,]+)\s+(students|users|sites|submissions|forms)/i,
  ];

  for (const bullet of bullets) {
    for (const pattern of patterns) {
      const match = bullet.match(pattern);
      if (match && stats.length < 4) {
        stats.push({ value: match[1], label: match[2].slice(0, 30) });
        break;
      }
    }
  }
  return stats;
}

function renderExecSummary(pres: PptxGenJS, data: BackendSlide): void {
  const slide = pres.addSlide();
  addSlideTitle(slide, data.title);

  const content = data.content as Record<string, unknown>;
  const bullets = (content.bullets as string[]) || [];
  let y: number = BRAND.layout.contentStartY;

  const stats = extractStatsFromBullets(bullets);
  if (stats.length > 0) {
    y = addStatCards(slide, stats, y);
  }

  addBulletList(slide, bullets, y);
}

function renderMetricsSlide(pres: PptxGenJS, data: BackendSlide): void {
  const slide = pres.addSlide();
  addSlideTitle(slide, data.title);

  const content = data.content as Record<string, unknown>;
  const bullets = (content.bullets as string[]) || [];
  const chartSpecs = (content.chartSpecs as any[]) || [];

  let y: number = BRAND.layout.contentStartY;

  // Extract stat cards from gauge/number chart specs
  const gauges = chartSpecs.filter(
    (c) => c.chartType === 'gauge' || c.chartType === 'number',
  );
  if (gauges.length > 0) {
    const stats = gauges.map((g: any) => ({
      label: g.title || '',
      value: `${g.data?.value ?? ''}${typeof g.data?.value === 'number' && g.data?.max === 100 ? '%' : ''}`,
    }));
    y = addStatCards(slide, stats, y);
  }

  // Bullets
  if (bullets.length > 0) {
    y = addBulletList(slide, bullets, y);
  }

  // Bar charts
  const barCharts = chartSpecs.filter((c) => c.chartType === 'bar');
  for (const chart of barCharts) {
    if (y < BRAND.slide.height - 1.5) {
      y = addBarChart(slide, chart, y);
    }
  }
}

function renderGongSlide(pres: PptxGenJS, data: BackendSlide): void {
  const slide = pres.addSlide();
  addSlideTitle(slide, data.title);

  const content = data.content as Record<string, unknown>;
  const bullets = (content.bullets as string[]) || [];
  const quotes = (content.quotes as any[]) || [];

  let y: number = BRAND.layout.contentStartY;

  if (bullets.length > 0) {
    y = addBulletList(slide, bullets, y);
    y += 0.1;
  }

  for (const quote of quotes) {
    if (y >= BRAND.slide.height - 1) break;
    const qText = typeof quote === 'string' ? quote : quote.text;
    const qAttr = typeof quote === 'string' ? undefined : quote.attribution;
    y = addQuoteBox(slide, qText, qAttr, y);
  }
}

function renderBulletSlide(pres: PptxGenJS, data: BackendSlide): void {
  const slide = pres.addSlide();
  addSlideTitle(slide, data.title);

  const content = data.content as Record<string, unknown>;
  const bullets = (content.bullets as string[]) || [];

  addBulletList(slide, bullets, BRAND.layout.contentStartY);
}

function renderNextSteps(pres: PptxGenJS, data: BackendSlide): void {
  const slide = pres.addSlide();
  addSlideTitle(slide, data.title);

  const content = data.content as Record<string, unknown>;
  const bullets = (content.bullets as string[]) || [];
  const nextActionCta = content.nextActionCta as string | undefined;

  let y: number = BRAND.layout.contentStartY;

  if (bullets.length > 0) {
    y = addBulletList(slide, bullets, y);
    y += 0.15;
  }

  // CTA button-style box
  if (nextActionCta) {
    const ctaW = BRAND.slide.width - BRAND.layout.margin * 2 - 2;
    const ctaX = BRAND.layout.margin + 1;

    slide.addShape('rect', {
      x: ctaX,
      y,
      w: ctaW,
      h: 0.6,
      fill: { color: BRAND.colors.teal },
      rectRadius: 0.05,
    });

    slide.addText(nextActionCta, {
      x: ctaX,
      y,
      w: ctaW,
      h: 0.6,
      fontSize: BRAND.fontSize.body,
      fontFace: BRAND.fonts.primary,
      color: BRAND.colors.white,
      bold: true,
      align: 'center',
      valign: 'middle',
    });
  }
}

// ── Renderer dispatch table ─────────────────────────────────────────
const RENDERERS: Record<
  string,
  (pres: PptxGenJS, data: BackendSlide) => void
> = {
  exec_summary: renderExecSummary,
  adoption_metrics: renderMetricsSlide,
  user_activation: renderMetricsSlide,
  site_coverage: renderMetricsSlide,
  form_usage: renderMetricsSlide,
  sendbacks: renderBulletSlide,
  gong_insights: renderGongSlide,
  root_cause: renderBulletSlide,
  recommendations: renderBulletSlide,
  next_steps: renderNextSteps,
};

// ── Main export ─────────────────────────────────────────────────────
export async function generateInternalReport(
  options: InternalReportOptions,
): Promise<Buffer> {
  const pres = new PptxGenJS();

  // Layout
  pres.defineLayout({
    name: 'IK12_16x9',
    width: BRAND.slide.width,
    height: BRAND.slide.height,
  });
  pres.layout = 'IK12_16x9';
  pres.author = 'iKnowAll12';
  pres.title = `${options.districtName} \u2014 Internal Adoption Report`;

  // Title slide
  addTitleSlide(pres, options.districtName, options.campaignName);

  // Content slides
  for (const slideData of options.slides) {
    const renderer = RENDERERS[slideData.type] ?? renderBulletSlide;
    renderer(pres, slideData);
  }

  // Closing slide
  addClosingSlide(pres, options.districtName);

  const buffer = await pres.write({ outputType: 'nodebuffer' });
  return buffer as Buffer;
}
