import { z } from 'zod';

// ── Source traceability ─────────────────────────────────────────────
export const SourceRefSchema = z.object({
  tableId: z.string(),
  columns: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const TrackedClaimSchema = z.object({
  claim: z.string(),
  confidence: z.enum(['High', 'Medium', 'Low']),
  sources: z.array(SourceRefSchema),
});

// ── Chart spec (frontend renders) ──────────────────────────────────
export const ChartSpecSchema = z.object({
  chartType: z.enum(['bar', 'line', 'pie', 'donut', 'number', 'table', 'progress']),
  title: z.string(),
  data: z.unknown(),
  notes: z.string().optional(),
});

// ── Internal Deck ──────────────────────────────────────────────────
export const SlideSchema = z.object({
  slideNumber: z.number(),
  title: z.string(),
  sections: z.array(z.object({
    heading: z.string().optional(),
    bullets: z.array(z.string()).optional(),
    chartSpecs: z.array(ChartSpecSchema).optional(),
    quotes: z.array(z.string()).optional(),
    trackedClaims: z.array(TrackedClaimSchema).optional(),
  })),
});

export const InternalDeckSchema = z.object({
  reportType: z.literal('internal'),
  title: z.string(),
  districtName: z.string(),
  generatedAt: z.string(),
  slides: z.array(SlideSchema),
});

// ── External Spotlight ─────────────────────────────────────────────
export const SpotlightSchema = z.object({
  reportType: z.literal('spotlight'),
  title: z.string(),
  districtName: z.string(),
  generatedAt: z.string(),
  onePage: z.object({
    header: z.string(),
    subheader: z.string().optional(),
    kpis: z.array(z.object({
      label: z.string(),
      value: z.string(),
      delta: z.string().optional(),
    })),
    charts: z.array(ChartSpecSchema).optional(),
    quotes: z.array(z.object({
      text: z.string(),
      attribution: z.string().optional(),
    })).optional(),
    closingCta: z.string().optional(),
    trackedClaims: z.array(TrackedClaimSchema).optional(),
  }),
});

// ── Story mode (Spotify-wrapped style) ─────────────────────────────
export const StoryFrameSchema = z.object({
  frameNumber: z.number(),
  templateType: z.enum(['intro', 'stat', 'quote', 'chart', 'milestone', 'cta']),
  headline: z.string(),
  narrative: z.string().optional(),
  chartSpec: ChartSpecSchema.optional(),
  nextActionCta: z.string().optional(),
  trackedClaims: z.array(TrackedClaimSchema).optional(),
});

export const StorySchema = z.object({
  reportType: z.literal('story'),
  title: z.string(),
  districtName: z.string(),
  generatedAt: z.string(),
  frames: z.array(StoryFrameSchema),
});

// ── Diagnostics ────────────────────────────────────────────────────
export const DiagnosticsSchema = z.object({
  confidenceByClaim: z.array(TrackedClaimSchema),
  dataGaps: z.array(z.string()),
  sourceMap: z.array(z.object({
    tableId: z.string(),
    filename: z.string(),
    tableType: z.string(),
    rowCount: z.number(),
  })),
});

// ── Top-level generated report (LLM output shape) ────────────────
export const GeneratedReportSchema = z.object({
  internal: InternalDeckSchema.optional(),
  spotlight: SpotlightSchema.optional(),
  story: StorySchema.optional(),
  diagnostics: DiagnosticsSchema,
});

// ── Recap (derived from story frames) ─────────────────────────────
export const RecapSchema = z.object({
  title: z.string(),
  districtName: z.string(),
  generatedAt: z.string(),
  frames: z.array(StoryFrameSchema),
});

// ── Canonical API response envelope ───────────────────────────────
export const ApiDiagnosticsSchema = z.object({
  usedMock: z.boolean(),
  provider: z.enum(['gemini', 'claude', 'mock']),
  requestedTypes: z.array(z.string()),
  requestId: z.string(),
  timingsMs: z.object({
    parse: z.number(),
    llm: z.number(),
    total: z.number(),
  }),
  error: z.string().optional(),
});

export const ApiResponseSchema = z.object({
  ok: z.literal(true),
  report: z.object({
    internalDeck: z.object({ slides: z.array(SlideSchema) }).nullable(),
    spotlight: z.object({ onePage: SpotlightSchema.shape.onePage }).nullable(),
    diagnostics: DiagnosticsSchema,
  }),
  recap: RecapSchema,
  diagnostics: ApiDiagnosticsSchema,
});

// ── TypeScript types ───────────────────────────────────────────────
export type SourceRef = z.infer<typeof SourceRefSchema>;
export type TrackedClaim = z.infer<typeof TrackedClaimSchema>;
export type ChartSpec = z.infer<typeof ChartSpecSchema>;
export type Slide = z.infer<typeof SlideSchema>;
export type InternalDeck = z.infer<typeof InternalDeckSchema>;
export type Spotlight = z.infer<typeof SpotlightSchema>;
export type StoryFrame = z.infer<typeof StoryFrameSchema>;
export type Story = z.infer<typeof StorySchema>;
export type Diagnostics = z.infer<typeof DiagnosticsSchema>;
export type GeneratedReport = z.infer<typeof GeneratedReportSchema>;
export type Recap = z.infer<typeof RecapSchema>;
export type ApiDiagnostics = z.infer<typeof ApiDiagnosticsSchema>;
export type ApiResponse = z.infer<typeof ApiResponseSchema>;
