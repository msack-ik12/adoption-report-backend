import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { logger } from '../utils/logger';
import { GeneratedReportSchema, GeneratedReport } from './schema';
import { NormalizedPayload } from './normalizeInputs';

const SYSTEM_PROMPT = `You are an expert K-12 edtech adoption analyst. Your job is to produce structured report content for an internal "Adoption Report Generator" app.

You will receive a normalized JSON payload containing:
- District info (name, campaign, fast facts)
- Parsed Sigma CSV data (table summaries, headers, sample rows, computed summaries)
- Gong AI call summaries (sections extracted from call notes)
- Optional prerequisite checklist data
- Derived metrics (adoption evaluation, top forms, site coverage, user activation, sendbacks)

You MUST return ONLY valid JSON matching the requested schema. No prose, no markdown, no explanation outside the JSON object.

REPORT TYPES you may be asked to generate (one or more):

1. **internal** — Internal Adoption Report (slide deck structure)
   - Produce an array of slides, each with title, sections containing bullets, chartSpecs, quotes, and trackedClaims
   - Required slides: Executive Summary, Adoption Status, User Activation, Site Coverage, Forms Usage, Sendbacks Analysis, Gong Insights (if data available), Recommendations, Next Steps
   - Every non-trivial claim must include confidence (High/Medium/Low) and source references (tableId, columns)

2. **spotlight** — External Customer Spotlight (one-page)
   - Produce a single onePage object with header, kpis, charts, quotes, closingCta
   - Focus on positive outcomes, real metrics, and customer voice
   - Include trackedClaims for verifiability

3. **story** — Story Mode (Spotify-wrapped style frames)
   - Produce an array of frames with templateType (intro/stat/quote/chart/milestone/cta), headline, narrative, chartSpec
   - Make it engaging, data-driven, and sequentially compelling
   - End with a CTA frame

RULES:
- Reference data by tableId from the payload
- If data is insufficient for a claim, set confidence to "Low" and note the gap
- chartSpecs should specify chartType, title, and data structure the frontend can render
- All numbers must come from the provided data; do not fabricate statistics
- Include a diagnostics object with: confidenceByClaim, dataGaps, sourceMap

OUTPUT FORMAT (strict JSON):
{
  "internal": { ... } | undefined,
  "spotlight": { ... } | undefined,
  "story": { ... } | undefined,
  "diagnostics": {
    "confidenceByClaim": [...],
    "dataGaps": [...],
    "sourceMap": [...]
  }
}`;

function buildUserMessage(payload: NormalizedPayload, reportTypes: string[]): string {
  return JSON.stringify({
    instruction: `Generate the following report types: ${reportTypes.join(', ')}`,
    reportTypes,
    payload,
  }, null, 2);
}

// ── Mock Claude response for development without API key ───────────
function getMockResponse(payload: NormalizedPayload, reportTypes: string[]): GeneratedReport {
  const now = new Date().toISOString();
  const district = payload.district.name;

  const result: GeneratedReport = {
    diagnostics: {
      confidenceByClaim: [
        {
          claim: `${district} shows strong adoption indicators based on available data`,
          confidence: 'Medium',
          sources: payload.files.sigma.map(s => ({ tableId: s.tableId, columns: s.headers.slice(0, 3) })),
        },
      ],
      dataGaps: payload.derived.adoptionMetrics.missingInputs,
      sourceMap: payload.files.sigma.map(s => ({
        tableId: s.tableId,
        filename: s.filename,
        tableType: s.tableType,
        rowCount: s.rowCount,
      })),
    },
  };

  if (reportTypes.includes('internal')) {
    result.internal = {
      reportType: 'internal',
      title: `${district} Adoption Report`,
      districtName: district,
      generatedAt: now,
      slides: [
        {
          slideNumber: 1,
          title: 'Executive Summary',
          sections: [{
            heading: 'Overview',
            bullets: [
              `${district} implementation analysis based on ${payload.files.sigma.length} data source(s)`,
              `Adoption status: ${payload.derived.adoptionMetrics.adoptionMet === true ? 'MET' : payload.derived.adoptionMetrics.adoptionMet === false ? 'NOT MET' : 'INSUFFICIENT DATA'}`,
              `Confidence: ${payload.derived.adoptionMetrics.adoptionConfidence}`,
            ],
            trackedClaims: [{
              claim: 'Adoption evaluation based on provided Sigma data',
              confidence: payload.derived.adoptionMetrics.adoptionConfidence,
              sources: payload.files.sigma.map(s => ({ tableId: s.tableId })),
            }],
          }],
        },
        {
          slideNumber: 2,
          title: 'Adoption Status',
          sections: [{
            heading: 'Key Metrics',
            bullets: [
              `Weekly active user percentage: ${payload.derived.adoptionMetrics.weeklyActiveUserPct ?? 'N/A'}%`,
              `All sites have active office managers: ${payload.derived.adoptionMetrics.allSitesHaveActiveOfficeManager ?? 'N/A'}`,
              `User activation: ${payload.derived.userActivation.pct ?? 'N/A'}%`,
              `Site coverage: ${payload.derived.siteCoverage.pct ?? 'N/A'}%`,
            ],
            chartSpecs: [{
              chartType: 'progress',
              title: 'Adoption Progress',
              data: {
                current: payload.derived.adoptionMetrics.weeklyActiveUserPct ?? 0,
                target: 70,
                label: 'Weekly Active Users',
              },
            }],
          }],
        },
        {
          slideNumber: 3,
          title: 'Forms Usage',
          sections: [{
            heading: 'Top Forms',
            bullets: payload.derived.topForms.length > 0
              ? payload.derived.topForms.map(f => `${f.formName}: ${f.count} submissions`)
              : ['No forms usage data available'],
            chartSpecs: payload.derived.topForms.length > 0 ? [{
              chartType: 'bar',
              title: 'Top Forms by Usage',
              data: payload.derived.topForms,
            }] : [],
          }],
        },
        {
          slideNumber: 4,
          title: 'Recommendations & Next Steps',
          sections: [{
            heading: 'Recommended Actions',
            bullets: [
              'Review data gaps identified in diagnostics',
              'Schedule follow-up with district stakeholders',
              'Monitor weekly active user trends',
            ],
          }],
        },
      ],
    };
  }

  if (reportTypes.includes('spotlight')) {
    result.spotlight = {
      reportType: 'spotlight',
      title: `${district} Customer Spotlight`,
      districtName: district,
      generatedAt: now,
      onePage: {
        header: `${district} — Transforming School Operations`,
        subheader: payload.district.campaignName || 'Digital Adoption Journey',
        kpis: [
          { label: 'Active Users', value: `${payload.derived.userActivation.pct ?? 'N/A'}%` },
          { label: 'Sites Active', value: `${payload.derived.siteCoverage.activeSites ?? 'N/A'}/${payload.derived.siteCoverage.totalSites ?? 'N/A'}` },
          { label: 'Top Form', value: payload.derived.topForms[0]?.formName ?? 'N/A' },
        ],
        closingCta: 'Ready to see similar results? Contact your account team.',
      },
    };
  }

  if (reportTypes.includes('story')) {
    result.story = {
      reportType: 'story',
      title: `${district} Story`,
      districtName: district,
      generatedAt: now,
      frames: [
        { frameNumber: 1, templateType: 'intro', headline: `${district}'s Digital Journey`, narrative: 'A look at how this district is transforming operations.' },
        { frameNumber: 2, templateType: 'stat', headline: 'User Adoption', narrative: `${payload.derived.userActivation.pct ?? '?'}% of users are actively engaged.`, chartSpec: { chartType: 'number', title: 'Active Users', data: { value: payload.derived.userActivation.pct ?? 0 } } },
        { frameNumber: 3, templateType: 'milestone', headline: 'Sites Connected', narrative: `${payload.derived.siteCoverage.activeSites ?? '?'} out of ${payload.derived.siteCoverage.totalSites ?? '?'} sites are live.` },
        { frameNumber: 4, templateType: 'cta', headline: 'What\'s Next?', narrative: 'Continue the momentum with targeted training and support.', nextActionCta: 'Schedule a review session' },
      ],
    };
  }

  return result;
}

// ── Real Claude call ───────────────────────────────────────────────
export async function callClaude(
  payload: NormalizedPayload,
  reportTypes: string[],
): Promise<{ report: GeneratedReport; usedMock: boolean }> {
  // Mock mode
  if (config.isMockMode) {
    logger.warn('ANTHROPIC_API_KEY not set — using mock Claude response');
    const report = getMockResponse(payload, reportTypes);
    return { report, usedMock: true };
  }

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const userMessage = buildUserMessage(payload, reportTypes);

  logger.info('Calling Claude', { model: config.anthropicModel, reportTypes, payloadSize: userMessage.length });

  let rawText: string;
  try {
    const response = await client.messages.create({
      model: config.anthropicModel,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text block in Claude response');
    }
    rawText = textBlock.text;
  } catch (err: unknown) {
    const error = err as Error & { status?: number; error?: { type?: string } };
    if (error.status === 429) {
      logger.error('Claude rate limited', { status: 429 });
      throw new Error('Claude API rate limited. Please retry in a moment.');
    }
    if (error.status === 408 || error.message?.includes('timeout')) {
      logger.error('Claude timeout', { error: error.message });
      throw new Error('Claude API timed out. Please retry.');
    }
    logger.error('Claude API error', { error: error.message, status: error.status });
    throw new Error(`Claude API error: ${error.message}`);
  }

  // Parse and validate JSON
  let parsed: unknown;
  try {
    // Strip markdown code fences if present
    const cleaned = rawText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    logger.warn('Claude returned invalid JSON; attempting retry with fix prompt');
    return retryWithFixPrompt(client, rawText, payload, reportTypes);
  }

  const validation = GeneratedReportSchema.safeParse(parsed);
  if (!validation.success) {
    logger.warn('Claude response failed schema validation; attempting retry', {
      errors: validation.error.issues.slice(0, 5),
    });
    return retryWithFixPrompt(client, rawText, payload, reportTypes);
  }

  return { report: validation.data, usedMock: false };
}

async function retryWithFixPrompt(
  client: Anthropic,
  originalResponse: string,
  payload: NormalizedPayload,
  reportTypes: string[],
): Promise<{ report: GeneratedReport; usedMock: boolean }> {
  const fixPrompt = `Your previous response was not valid JSON or did not match the required schema. Here is what you returned:

---
${originalResponse.slice(0, 8000)}
---

Please fix it and return ONLY valid JSON matching the GeneratedReportSchema. The report types requested are: ${reportTypes.join(', ')}.
Include the diagnostics object. Return nothing but the JSON object.`;

  try {
    const response = await client.messages.create({
      model: config.anthropicModel,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: buildUserMessage(payload, reportTypes) },
        { role: 'assistant', content: originalResponse.slice(0, 4000) },
        { role: 'user', content: fixPrompt },
      ],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text in retry response');
    }

    const cleaned = textBlock.text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    const validation = GeneratedReportSchema.safeParse(parsed);

    if (!validation.success) {
      logger.error('Retry also failed schema validation', { errors: validation.error.issues.slice(0, 5) });
      throw new Error('Claude response failed schema validation after retry');
    }

    return { report: validation.data, usedMock: false };
  } catch (err) {
    logger.error('Retry failed', { error: String(err) });
    throw new Error(`Claude retry failed: ${String(err)}`);
  }
}
