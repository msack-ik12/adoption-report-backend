/**
 * V2 — Generates a branded Internal Adoption Report PPTX.
 *
 * Each slide type gets a rich, multi-element layout matching the
 * gold-standard Muskegon AISD report: two-column layouts, stat
 * cards with top accent bars, native bar charts, info cards with
 * semantic colors, quote callouts, priority-badged recommendation
 * cards, and progress indicators.
 */
import PptxGenJS from 'pptxgenjs';
import { BRAND, FULL_W } from './brand';
import {
  addContentSlide,
  addStatRow,
  addBullets,
  addInfoCard,
  addPriorityCard,
  addQuoteBox,
  addBarChart,
  addProgressBar,
  addSectionLabel,
  addSeparator,
} from './helpers';
import type { BackendSlide } from '../schema';

export interface InternalReportOptions {
  districtName: string;
  campaignName?: string;
  slides: BackendSlide[];
}

const M = BRAND.layout.margin;
const L = BRAND.layout.colLeft;
const R = BRAND.layout.colRight;

// ═══════════════════════════════════════════════════════════════════
// Title + Closing slides (solid indigo background)
// ═══════════════════════════════════════════════════════════════════

function addTitleSlide(pres: PptxGenJS, districtName: string, campaignName?: string): void {
  const slide = pres.addSlide();
  slide.background = { color: BRAND.colors.indigo };

  slide.addText(districtName, {
    x: 0, y: 1.2, w: BRAND.slide.width, h: 1.2,
    fontSize: BRAND.fontSize.heroTitle,
    fontFace: BRAND.fonts.primary,
    color: BRAND.colors.white,
    bold: true,
    align: 'center',
  });

  // Teal divider
  slide.addShape('rect', {
    x: 3, y: 2.5, w: 4, h: BRAND.layout.accentBarH,
    fill: { color: BRAND.colors.teal },
  });

  slide.addText(campaignName || 'Internal Adoption Report', {
    x: 0, y: 2.7, w: BRAND.slide.width, h: 0.7,
    fontSize: BRAND.fontSize.heroSubtitle,
    fontFace: BRAND.fonts.primary,
    color: BRAND.colors.teal,
    align: 'center',
  });

  slide.addText(
    new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    {
      x: 0, y: 4.6, w: BRAND.slide.width, h: 0.4,
      fontSize: BRAND.fontSize.body,
      fontFace: BRAND.fonts.primary,
      color: BRAND.colors.white,
      align: 'center',
      italic: true,
    },
  );
}

function addClosingSlide(pres: PptxGenJS, districtName: string): void {
  const slide = pres.addSlide();
  slide.background = { color: BRAND.colors.indigo };

  slide.addText('Thank You', {
    x: 0, y: 1.6, w: BRAND.slide.width, h: 1,
    fontSize: BRAND.fontSize.heroTitle,
    fontFace: BRAND.fonts.primary,
    color: BRAND.colors.white,
    bold: true,
    align: 'center',
  });

  slide.addShape('rect', {
    x: 3, y: 2.7, w: 4, h: BRAND.layout.accentBarH,
    fill: { color: BRAND.colors.teal },
  });

  slide.addText(districtName, {
    x: 0, y: 2.9, w: BRAND.slide.width, h: 0.6,
    fontSize: BRAND.fontSize.heroSubtitle,
    fontFace: BRAND.fonts.primary,
    color: BRAND.colors.teal,
    align: 'center',
  });
}

// ═══════════════════════════════════════════════════════════════════
// Content slide renderers
// ═══════════════════════════════════════════════════════════════════

function renderExecSummary(pres: PptxGenJS, data: BackendSlide): void {
  const { slide, y: startY } = addContentSlide(pres, data.title);
  const c = data.content as Record<string, unknown>;
  const bullets = (c.bullets as string[]) || [];
  let y: number = startY;

  // Extract key stats from bullets for stat cards
  const stats = extractStats(bullets);
  if (stats.length > 0) {
    y = addStatRow(slide, stats, y);
  }

  // Separator between stats and bullets
  y = addSeparator(slide, y);

  // Two-column: left = key points, right = additional bullets — fill available space
  const midpoint = Math.ceil(bullets.length / 2);
  const leftBullets = bullets.slice(0, midpoint);
  const rightBullets = bullets.slice(midpoint);

  if (rightBullets.length > 0) {
    addBullets(slide, leftBullets, y, { x: L.x, w: L.w, fillAvailable: true });
    addBullets(slide, rightBullets, y, { x: R.x, w: R.w, fillAvailable: true });
  } else {
    addBullets(slide, bullets, y, { fillAvailable: true });
  }
}

function renderMetricsSlide(pres: PptxGenJS, data: BackendSlide): void {
  const { slide, y: startY } = addContentSlide(pres, data.title);
  const c = data.content as Record<string, unknown>;
  const bullets = (c.bullets as string[]) || [];
  const chartSpecs = (c.chartSpecs as any[]) || [];
  let y: number = startY;

  // Stat cards from gauge/number chart specs
  const gauges = chartSpecs.filter((cs: any) => cs.chartType === 'gauge' || cs.chartType === 'number');
  if (gauges.length > 0) {
    const stats = gauges.map((g: any) => ({
      value: `${g.data?.value ?? ''}${g.chartType === 'gauge' && typeof g.data?.value === 'number' ? '%' : ''}`,
      label: g.title || '',
    }));
    y = addStatRow(slide, stats, y);
  }

  // Progress bars for gauges that have targets
  for (const g of gauges) {
    if (g.data?.target && y < 3.5) {
      addSectionLabel(slide, g.title, y, { x: L.x });
      y = addProgressBar(slide, g.data.value, g.data.target, g.data.max ?? 100, L.x, y + 0.3, L.w);
    }
  }

  // Data charts (bar, line, pie — all rendered as bar in PPTX)
  const dataCharts = chartSpecs.filter((cs: any) =>
    cs.chartType === 'bar' || cs.chartType === 'line' || cs.chartType === 'pie' || cs.chartType === 'donut');
  const availH = BRAND.slide.height - y - 0.4;

  if (dataCharts.length > 0 && bullets.length > 0) {
    const chartH = Math.max(Math.min(availH, 3.5), 1.8);
    addBarChart(slide, dataCharts[0], L.x, y, L.w, chartH);
    addSectionLabel(slide, 'Key Insights', y, { x: R.x });
    addBullets(slide, bullets, y + 0.35, { x: R.x, w: R.w, fontSize: BRAND.fontSize.small, fillAvailable: true });
  } else if (dataCharts.length > 0) {
    const chartH = Math.max(Math.min(availH, 4.0), 2.0);
    y = addBarChart(slide, dataCharts[0], M + 0.5, y, FULL_W - 1, chartH);
  } else if (bullets.length > 0) {
    addBullets(slide, bullets, y, { fillAvailable: true });
  }
}

function renderGongSlide(pres: PptxGenJS, data: BackendSlide): void {
  const { slide, y: startY } = addContentSlide(pres, data.title);
  const c = data.content as Record<string, unknown>;
  const bullets = (c.bullets as string[]) || [];
  const quotes = (c.quotes as any[]) || [];
  let y: number = startY;

  if (bullets.length > 0 && quotes.length > 0) {
    // Two-column: bullets left, quotes right — fill available space
    addSectionLabel(slide, 'Key Themes', y, { x: L.x });
    addBullets(slide, bullets, y + 0.35, { x: L.x, w: L.w, fontSize: BRAND.fontSize.small, fillAvailable: true });

    addSectionLabel(slide, 'What Users Are Saying', y, { x: R.x });
    let qy = y + 0.4;
    // Space quotes evenly in available area
    const quoteList = quotes.slice(0, 3);
    for (const q of quoteList) {
      if (qy >= BRAND.slide.height - 0.6) break;
      const txt = typeof q === 'string' ? q : q.text;
      const attr = typeof q === 'string' ? undefined : q.attribution;
      qy = addQuoteBox(slide, txt, attr, qy, { x: R.x, w: R.w });
      qy += 0.08; // extra breathing room between quotes
    }
  } else {
    // Single column fallback
    if (bullets.length > 0) {
      addSectionLabel(slide, 'Key Themes', y);
      y += 0.32;
      y = addBullets(slide, bullets, y);
      y += 0.2;
    }
    if (quotes.length > 0) {
      addSectionLabel(slide, 'What Users Are Saying', y);
      y += 0.32;
    }
    for (const q of quotes.slice(0, 3)) {
      if (y >= BRAND.slide.height - 0.6) break;
      const txt = typeof q === 'string' ? q : q.text;
      const attr = typeof q === 'string' ? undefined : q.attribution;
      y = addQuoteBox(slide, txt, attr, y);
      y += 0.08;
    }
  }
}

function renderRootCause(pres: PptxGenJS, data: BackendSlide): void {
  const { slide, y: startY } = addContentSlide(pres, data.title);
  const c = data.content as Record<string, unknown>;
  const bullets = (c.bullets as string[]) || [];
  const y: number = startY;

  // Render bullets as info cards in a 2-column grid, sized to fill the slide
  const cardW = (FULL_W - 0.25) / 2;
  const rows = Math.ceil(bullets.length / 2);
  const availH = BRAND.slide.height - y - 0.4;
  const gap = 0.2;
  const cardH = Math.min((availH - gap * (rows - 1)) / rows, 1.2);

  // Alternate colors for root cause categories
  const accentColors = [BRAND.colors.red, BRAND.colors.orange, BRAND.colors.indigoLight, BRAND.colors.teal];
  const bgColors = [BRAND.colors.paleRed, BRAND.colors.paleYellow, BRAND.colors.cardBg, BRAND.colors.paleTeal];

  bullets.forEach((bullet, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = M + col * (cardW + 0.25);
    const cy = y + row * (cardH + gap);

    if (cy + cardH > BRAND.slide.height - 0.2) return;

    addInfoCard(slide, {
      x: cx, y: cy, w: cardW, h: cardH,
      accentColor: accentColors[i % accentColors.length],
      bgColor: bgColors[i % bgColors.length],
      title: `Finding ${i + 1}`,
      body: bullet,
    });
  });
}

function renderRecommendations(pres: PptxGenJS, data: BackendSlide): void {
  const { slide, y: startY } = addContentSlide(pres, data.title);
  const c = data.content as Record<string, unknown>;
  const bullets = (c.bullets as string[]) || [];
  const y: number = startY;

  // Render as priority cards in a 2-column grid, sized to fill the slide
  const cardW = (FULL_W - 0.25) / 2;
  const rows = Math.ceil(bullets.length / 2);
  const availH = BRAND.slide.height - y - 0.4;
  const gap = 0.2;
  const cardH = Math.min((availH - gap * (rows - 1)) / rows, 1.2);

  bullets.forEach((bullet, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = M + col * (cardW + 0.25);
    const cy = y + row * (cardH + gap);

    if (cy + cardH > BRAND.slide.height - 0.2) return;

    const priority = i < 2 ? 'high' : i < 4 ? 'medium' : 'low';

    // Split bullet: first sentence → title, rest → body
    const sentenceEnd = bullet.indexOf('. ');
    const title = sentenceEnd > 0 ? bullet.slice(0, sentenceEnd) : bullet.slice(0, 60);
    const body = sentenceEnd > 0 ? bullet.slice(sentenceEnd + 2) : '';

    addPriorityCard(slide, { x: cx, y: cy, w: cardW, h: cardH, priority, title, body });
  });
}

function renderNextSteps(pres: PptxGenJS, data: BackendSlide): void {
  const { slide, y: startY } = addContentSlide(pres, data.title);
  const c = data.content as Record<string, unknown>;
  const bullets = (c.bullets as string[]) || [];
  const cta = c.nextActionCta as string | undefined;
  let y: number = startY;

  // Calculate card size to fill available space
  const ctaH = cta ? 0.6 : 0;
  const availH = BRAND.slide.height - y - 0.4 - ctaH;
  const gap = 0.2;
  const cardH = Math.min((availH - gap * (bullets.length - 1)) / bullets.length, 0.85);

  // Render as numbered action items in info cards
  bullets.forEach((bullet, i) => {
    if (y + cardH > BRAND.slide.height - 0.3 - ctaH) return;

    addInfoCard(slide, {
      x: M, y, w: FULL_W, h: cardH,
      accentColor: BRAND.colors.teal,
      bgColor: BRAND.colors.cardBg,
      title: `${i + 1}. ${bullet.slice(0, 90)}`,
      body: bullet.length > 90 ? bullet.slice(90) : undefined,
      titleBold: true,
    });

    y += cardH + gap;
  });

  // CTA bar at bottom
  if (cta) {
    const ctaY = Math.max(y + 0.1, BRAND.slide.height - 0.6);
    slide.addShape('rect', {
      x: M + 1, y: ctaY, w: FULL_W - 2, h: 0.5,
      fill: { color: BRAND.colors.teal },
      rectRadius: 0.06,
    });
    slide.addText(cta, {
      x: M + 1, y: ctaY, w: FULL_W - 2, h: 0.5,
      fontSize: BRAND.fontSize.body,
      fontFace: BRAND.fonts.primary,
      color: BRAND.colors.white,
      bold: true,
      align: 'center',
      valign: 'middle',
    });
  }
}

/** Default: two-column bullets + optional charts */
function renderGenericSlide(pres: PptxGenJS, data: BackendSlide): void {
  const { slide, y: startY } = addContentSlide(pres, data.title);
  const c = data.content as Record<string, unknown>;
  const bullets = (c.bullets as string[]) || [];
  const chartSpecs = (c.chartSpecs as any[]) || [];
  let y: number = startY;

  const dataCharts = chartSpecs.filter((cs: any) =>
    cs.chartType === 'bar' || cs.chartType === 'line' || cs.chartType === 'pie' || cs.chartType === 'donut');
  const availH = BRAND.slide.height - y - 0.4;

  if (dataCharts.length > 0 && bullets.length > 0) {
    // Two-column: chart left, bullets right
    const chartH = Math.max(Math.min(availH, 3.5), 1.8);
    addBarChart(slide, dataCharts[0], L.x, y, L.w, chartH);
    addSectionLabel(slide, 'Insights', y, { x: R.x });
    addBullets(slide, bullets, y + 0.35, { x: R.x, w: R.w, fontSize: BRAND.fontSize.small, fillAvailable: true });
  } else if (dataCharts.length > 0) {
    const chartH = Math.max(Math.min(availH, 4.0), 2.0);
    y = addBarChart(slide, dataCharts[0], M + 0.5, y, FULL_W - 1, chartH);
  } else if (bullets.length > 3) {
    // Two-column split for long bullet lists
    const mid = Math.ceil(bullets.length / 2);
    addBullets(slide, bullets.slice(0, mid), y, { x: L.x, w: L.w, fillAvailable: true });
    addBullets(slide, bullets.slice(mid), y, { x: R.x, w: R.w, fillAvailable: true });
  } else {
    addBullets(slide, bullets, y, { fillAvailable: true });
  }
}

// ═══════════════════════════════════════════════════════════════════
// Utility: extract numeric stats from bullet text
// ═══════════════════════════════════════════════════════════════════

function extractStats(bullets: string[]): Array<{ value: string; label: string }> {
  const stats: Array<{ value: string; label: string }> = [];

  for (const bullet of bullets) {
    if (stats.length >= 4) break;

    // Match "N% <word description>" — avoid embedded list percentages like "(35%)"
    const pctMatch = bullet.match(/\b(\d+\.?\d*%)\s+([\w\s]+?)(?:\s*[\(,;]|$)/);
    if (pctMatch && !bullet.slice(0, pctMatch.index).includes('(')) {
      const value = pctMatch[1];
      const label = pctMatch[2].trim().replace(/^\w/, (c: string) => c.toUpperCase()).slice(0, 30);
      if (!stats.some((s) => s.value === value) && label.length >= 4) {
        stats.push({ value, label });
        continue;
      }
    }

    // Match "at N%" with label from the beginning of the bullet
    const atPctMatch = bullet.match(/\bat\s+(\d+\.?\d*%)/i);
    if (atPctMatch) {
      const value = atPctMatch[1];
      // Derive label from text before "at N%"
      const prefix = bullet.slice(0, atPctMatch.index!).trim();
      const label = prefix.length >= 4 ? prefix.slice(0, 30) : bullet.slice(0, 30);
      if (!stats.some((s) => s.value === value)) {
        stats.push({ value, label });
        continue;
      }
    }

    // Match "N,NNN <entity type>"
    const countMatch = bullet.match(/\b(\d[\d,]+)\s+(?:total\s+)?(students|users|sites|submissions|forms|campaigns|sendbacks)/i);
    if (countMatch && !stats.some((s) => s.value === countMatch[1])) {
      stats.push({
        value: countMatch[1],
        label: countMatch[2].replace(/^\w/, (c: string) => c.toUpperCase()),
      });
    }
  }
  return stats;
}

// ═══════════════════════════════════════════════════════════════════
// Renderer dispatch
// ═══════════════════════════════════════════════════════════════════

const RENDERERS: Record<string, (pres: PptxGenJS, data: BackendSlide) => void> = {
  exec_summary: renderExecSummary,
  adoption_metrics: renderMetricsSlide,
  user_activation: renderMetricsSlide,
  site_coverage: renderMetricsSlide,
  form_usage: renderMetricsSlide,
  sendbacks: renderGenericSlide,
  gong_insights: renderGongSlide,
  root_cause: renderRootCause,
  recommendations: renderRecommendations,
  next_steps: renderNextSteps,
};

// ═══════════════════════════════════════════════════════════════════
// Main export
// ═══════════════════════════════════════════════════════════════════

export async function generateInternalReport(options: InternalReportOptions): Promise<Buffer> {
  const pres = new PptxGenJS();

  pres.defineLayout({ name: 'IK12_16x9', width: BRAND.slide.width, height: BRAND.slide.height });
  pres.layout = 'IK12_16x9';
  pres.author = 'iKnowAll12';
  pres.title = `${options.districtName} \u2014 Internal Adoption Report`;

  addTitleSlide(pres, options.districtName, options.campaignName);

  for (const slideData of options.slides) {
    const renderer = RENDERERS[slideData.type] ?? renderGenericSlide;
    renderer(pres, slideData);
  }

  addClosingSlide(pres, options.districtName);

  const buffer = await pres.write({ outputType: 'nodebuffer' });
  return buffer as Buffer;
}
