import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { config, GEMINI_FALLBACK_MODEL } from '../config';
import { logger } from '../utils/logger';
import { GeneratedReportSchema, GeneratedReport } from './schema';
import { NormalizedPayload } from './normalizeInputs';

// Re-export for backward compatibility
export { GeneratedReport } from './schema';
export { NormalizedPayload } from './normalizeInputs';

export type LLMProvider = 'gemini' | 'claude' | 'mock';

export interface LLMResult {
  report: GeneratedReport;
  usedMock: boolean;
  provider: LLMProvider;
  llmMs: number;
  error?: string;
}

// ── Gemini model validation ──────────────────────────────────────
let validatedGeminiModel: string | null = null;

async function resolveGeminiModel(): Promise<string> {
  if (validatedGeminiModel) return validatedGeminiModel;

  const requested = config.geminiModel;
  const apiKey = config.geminiApiKey;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    if (!res.ok) {
      logger.warn('Gemini models.list failed, using fallback model', {
        status: res.status,
        requested,
        fallback: GEMINI_FALLBACK_MODEL,
      });
      validatedGeminiModel = GEMINI_FALLBACK_MODEL;
      return validatedGeminiModel;
    }

    const data = (await res.json()) as {
      models?: { name: string; supportedGenerationMethods?: string[] }[];
    };
    const models = data.models ?? [];
    const match = models.find(
      (m) =>
        m.name === `models/${requested}` &&
        m.supportedGenerationMethods?.includes('generateContent')
    );

    if (match) {
      logger.info('Gemini model validated', { model: requested });
      validatedGeminiModel = requested;
    } else {
      logger.warn('Gemini model not found or lacks generateContent support', {
        requested,
        fallback: GEMINI_FALLBACK_MODEL,
      });
      validatedGeminiModel = GEMINI_FALLBACK_MODEL;
    }
  } catch (err) {
    logger.warn('Gemini models.list call failed, using fallback model', {
      error: (err as Error).message,
      fallback: GEMINI_FALLBACK_MODEL,
    });
    validatedGeminiModel = GEMINI_FALLBACK_MODEL;
  }

  return validatedGeminiModel;
}

// ── System prompt ────────────────────────────────────────────────
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
   Each slide MUST use this exact shape:
   {
     "id": "<slug>",
     "title": "<human-readable title>",
     "type": "<same slug as id>",
     "content": { ... slide-specific fields ... }
   }

   Use these slide IDs (include all that have relevant data):
   - "exec_summary" — Executive Summary. content: { bullets: string[], trackedClaims: [...] }
   - "adoption_metrics" — Adoption Status. content: { bullets: string[], chartSpecs: [...], trackedClaims: [...] }
   - "user_activation" — User Activation. content: { bullets: string[], chartSpecs: [...] }
   - "site_coverage" — Site Coverage. content: { bullets: string[], chartSpecs: [...] }
   - "form_usage" — Forms Usage. content: { bullets: string[], chartSpecs: [...] }
   - "sendbacks" — Sendbacks Analysis. content: { bullets: string[], chartSpecs: [...] }
   - "gong_insights" — Gong Insights (only if gong data available). content: { bullets: string[], quotes: string[] }
   - "root_cause" — Root Cause Analysis. content: { bullets: string[] }
   - "recommendations" — Recommendations. content: { bullets: string[] }
   - "next_steps" — Next Steps. content: { bullets: string[], nextActionCta?: string }

   Every non-trivial claim must include confidence (High/Medium/Low) and source references (tableId, columns) inside trackedClaims within content.

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

OUTPUT FORMAT (strict JSON, no markdown fences):
{
  "internal": { "reportType": "internal", "title": "...", "districtName": "...", "generatedAt": "...", "slides": [...] } | undefined,
  "spotlight": { "reportType": "spotlight", "title": "...", "districtName": "...", "generatedAt": "...", "onePage": {...} } | undefined,
  "story": { "reportType": "story", "title": "...", "districtName": "...", "generatedAt": "...", "frames": [...] } | undefined,
  "diagnostics": {
    "confidenceByClaim": [...],
    "dataGaps": [...],
    "sourceMap": [...]
  }
}`;

function buildUserMessage(payload: NormalizedPayload, reportTypes: string[]): string {
  return JSON.stringify({
    instruction: `Generate the following report types: ${reportTypes.join(', ')}. Return ONLY valid JSON, no markdown fences.`,
    reportTypes,
    payload,
  }, null, 2);
}

const FIX_JSON_PROMPT = `The JSON you returned was invalid or did not match the required schema. Fix it so it is valid JSON matching the schema exactly. Return ONLY the corrected JSON object, no markdown fences, no explanation.`;

// ── Mock response for development without API key ───────────────
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
          id: 'exec_summary',
          title: 'Executive Summary',
          type: 'exec_summary',
          content: {
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
          },
        },
        {
          id: 'adoption_metrics',
          title: 'Adoption Status',
          type: 'adoption_metrics',
          content: {
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
          },
        },
        {
          id: 'form_usage',
          title: 'Forms Usage',
          type: 'form_usage',
          content: {
            bullets: payload.derived.topForms.length > 0
              ? payload.derived.topForms.map(f => `${f.formName}: ${f.count} submissions`)
              : ['No forms usage data available'],
            chartSpecs: payload.derived.topForms.length > 0 ? [{
              chartType: 'bar',
              title: 'Top Forms by Usage',
              data: payload.derived.topForms,
            }] : [],
          },
        },
        {
          id: 'recommendations',
          title: 'Recommendations',
          type: 'recommendations',
          content: {
            bullets: [
              'Review data gaps identified in diagnostics',
              'Schedule follow-up with district stakeholders',
              'Monitor weekly active user trends',
            ],
          },
        },
        {
          id: 'next_steps',
          title: 'Next Steps',
          type: 'next_steps',
          content: {
            bullets: [
              'Address low-engagement sites with targeted training',
              'Create quick-reference guides for sendback workflows',
              'Schedule quarterly review with district leadership',
            ],
            nextActionCta: 'Schedule follow-up review',
          },
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

// ── Gemini call ─────────────────────────────────────────────────
async function callGeminiRaw(
  payload: NormalizedPayload,
  reportTypes: string[],
): Promise<string> {
  const modelName = await resolveGeminiModel();
  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const userMessage = buildUserMessage(payload, reportTypes);
  logger.info('Calling Gemini', { model: modelName, reportTypes, payloadSize: userMessage.length });

  const result = await model.generateContent(userMessage);
  return result.response.text();
}

async function callGeminiRetry(
  failedText: string,
  validationError: string,
): Promise<string> {
  const modelName = await resolveGeminiModel();
  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const retryMessage = `${FIX_JSON_PROMPT}\n\nPrevious output (invalid):\n${failedText.slice(0, 4000)}\n\nValidation error: ${validationError}`;
  logger.info('Gemini retry with fix prompt');
  const result = await model.generateContent(retryMessage);
  return result.response.text();
}

// ── Claude call ─────────────────────────────────────────────────
async function callClaudeRaw(
  payload: NormalizedPayload,
  reportTypes: string[],
): Promise<string> {
  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const userMessage = buildUserMessage(payload, reportTypes);

  logger.info('Calling Claude', { model: config.anthropicModel, reportTypes, payloadSize: userMessage.length });

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
  return textBlock.text;
}

async function callClaudeRetry(
  failedText: string,
  validationError: string,
): Promise<string> {
  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const retryMessage = `${FIX_JSON_PROMPT}\n\nPrevious output (invalid):\n${failedText.slice(0, 4000)}\n\nValidation error: ${validationError}`;

  logger.info('Claude retry with fix prompt');
  const response = await client.messages.create({
    model: config.anthropicModel,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: retryMessage }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text block in Claude retry response');
  }
  return textBlock.text;
}

// ── Shared JSON parse + schema validation ───────────────────────
function cleanRawText(rawText: string): string {
  return rawText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

function parseAndValidate(rawText: string): GeneratedReport {
  const cleaned = cleanRawText(rawText);
  const parsed = JSON.parse(cleaned);
  const validation = GeneratedReportSchema.safeParse(parsed);
  if (!validation.success) {
    const issues = validation.error.issues.slice(0, 5).map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Schema validation failed: ${issues}`);
  }
  return validation.data;
}

// ── Unified entry point ──────────────────────────────────────────
export async function callLLM(
  payload: NormalizedPayload,
  reportTypes: string[],
): Promise<LLMResult> {
  const provider = config.llmProvider;

  if (provider === 'mock') {
    logger.warn('No API key configured — using mock response');
    const report = getMockResponse(payload, reportTypes);
    return { report, usedMock: true, provider: 'mock', llmMs: 0 };
  }

  const llmStart = Date.now();

  // First attempt
  let rawText: string;
  try {
    rawText = provider === 'gemini'
      ? await callGeminiRaw(payload, reportTypes)
      : await callClaudeRaw(payload, reportTypes);
  } catch (err: unknown) {
    const error = err as Error & { status?: number };
    logger.error(`${provider} API error`, { error: error.message, status: error.status });

    // Fall back to mock on API failure
    logger.warn(`${provider} call failed, falling back to mock`, { error: error.message });
    const report = getMockResponse(payload, reportTypes);
    return {
      report,
      usedMock: true,
      provider: 'mock',
      llmMs: Date.now() - llmStart,
      error: `${provider} API error: ${error.message}`,
    };
  }

  // First parse attempt
  try {
    const report = parseAndValidate(rawText);
    return { report, usedMock: false, provider, llmMs: Date.now() - llmStart };
  } catch (firstError) {
    const firstMsg = firstError instanceof Error ? firstError.message : String(firstError);
    logger.warn(`${provider} response failed validation, retrying`, { error: firstMsg });

    // One automatic retry with fix prompt
    try {
      const retryText = provider === 'gemini'
        ? await callGeminiRetry(rawText, firstMsg)
        : await callClaudeRetry(rawText, firstMsg);

      const report = parseAndValidate(retryText);
      logger.info(`${provider} retry succeeded`);
      return { report, usedMock: false, provider, llmMs: Date.now() - llmStart };
    } catch (retryError) {
      const retryMsg = retryError instanceof Error ? retryError.message : String(retryError);
      logger.error(`${provider} retry also failed, falling back to mock`, { error: retryMsg });

      const report = getMockResponse(payload, reportTypes);
      return {
        report,
        usedMock: true,
        provider: 'mock',
        llmMs: Date.now() - llmStart,
        error: `${provider} produced invalid JSON after retry: ${firstMsg}`,
      };
    }
  }
}

// Backward-compatible alias so existing imports keep working
export const callClaude = callLLM;
