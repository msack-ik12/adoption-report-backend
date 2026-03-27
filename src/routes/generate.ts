import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { logger } from '../utils/logger';
import { requireToken, requireDistrictName } from '../utils/validate';
import { parseCsvBuffer, ParsedTable } from '../services/parseCsv';
import { parseWorkbookBuffer } from '../services/parseWorkbook';
import { parseGongBuffer, parseGongText, ParsedGong } from '../services/parseGong';
import { normalizeInputs, FastFacts, NormalizedPayload } from '../services/normalizeInputs';
import { callLLM } from '../services/llm';
import { ApiResponse } from '../services/schema';
import { isGongConfigured, getTranscriptsAsText } from '../services/gongApi';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
});

const uploadFields = upload.fields([
  { name: 'sigmaFiles', maxCount: 20 },
  { name: 'gongFile', maxCount: 1 },
  { name: 'checklistFile', maxCount: 1 },
]);

const router = Router();

interface MulterFiles {
  sigmaFiles?: Express.Multer.File[];
  gongFile?: Express.Multer.File[];
  checklistFile?: Express.Multer.File[];
}

async function parseRequestInputs(req: Request): Promise<{
  districtName: string;
  campaignName?: string;
  reportTypes: string[];
  fastFacts?: FastFacts;
  sigmaTables: ParsedTable[];
  gong: ParsedGong | null;
  checklistTable: ParsedTable | null;
}> {
  const { districtName, campaignName, reportTypes: reportTypesRaw, gongText, gongCallIds: gongCallIdsRaw, fastFacts: fastFactsRaw } = req.body;
  const files = (req.files || {}) as MulterFiles;

  // Report types
  const reportTypes = reportTypesRaw
    ? String(reportTypesRaw).split(',').map((s: string) => s.trim()).filter(Boolean)
    : ['internal'];

  // Fast facts
  let fastFacts: FastFacts | undefined;
  if (fastFactsRaw) {
    try {
      fastFacts = typeof fastFactsRaw === 'string' ? JSON.parse(fastFactsRaw) : fastFactsRaw;
    } catch {
      logger.warn('Failed to parse fastFacts JSON', { raw: String(fastFactsRaw).slice(0, 200) });
    }
  }

  // Parse sigma files (CSV or XLS/XLSX workbook)
  const sigmaTables: ParsedTable[] = [];
  if (files.sigmaFiles) {
    for (const file of files.sigmaFiles) {
      logger.info('Processing sigma file', { filename: file.originalname, size: file.size });
      const ext = file.originalname.toLowerCase();
      if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
        const sheets = parseWorkbookBuffer(file.buffer, file.originalname);
        logger.info('Workbook split into sheets', {
          filename: file.originalname,
          sheetCount: sheets.length,
          sheetNames: sheets.map(s => s.filename),
        });
        sigmaTables.push(...sheets);
      } else {
        sigmaTables.push(parseCsvBuffer(file.buffer, file.originalname));
      }
    }
  }

  // Parse gong — priority: uploaded file > pasted text > API call IDs
  let gong: ParsedGong | null = null;
  if (files.gongFile && files.gongFile.length > 0) {
    const gf = files.gongFile[0];
    logger.info('Processing gong file', { filename: gf.originalname, size: gf.size });
    gong = await parseGongBuffer(gf.buffer, gf.originalname);
  } else if (gongText && typeof gongText === 'string' && gongText.trim().length > 0) {
    gong = parseGongText(gongText);
  } else if (gongCallIdsRaw) {
    // Accept gongCallIds as JSON array string or comma-separated
    let callIds: string[] = [];
    try {
      callIds = typeof gongCallIdsRaw === 'string' ? JSON.parse(gongCallIdsRaw) : gongCallIdsRaw;
    } catch {
      callIds = String(gongCallIdsRaw).split(',').map(s => s.trim()).filter(Boolean);
    }

    if (callIds.length > 0 && isGongConfigured()) {
      logger.info('Fetching Gong transcripts via API', { callIds: callIds.length });
      const transcriptText = await getTranscriptsAsText(callIds);
      if (transcriptText.trim().length > 0) {
        gong = parseGongText(transcriptText);
      }
    }
  }

  // Parse checklist
  let checklistTable: ParsedTable | null = null;
  if (files.checklistFile && files.checklistFile.length > 0) {
    const cf = files.checklistFile[0];
    logger.info('Processing checklist file', { filename: cf.originalname, size: cf.size });
    checklistTable = parseCsvBuffer(cf.buffer, cf.originalname);
  }

  return { districtName: String(districtName).trim(), campaignName, reportTypes, fastFacts, sigmaTables, gong, checklistTable };
}

// ── POST /generate ─────────────────────────────────────────────────
router.post('/generate', uploadFields, requireToken, requireDistrictName, async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const totalStart = Date.now();

  try {
    const parseStart = Date.now();
    const inputs = await parseRequestInputs(req);
    const parseMs = Date.now() - parseStart;

    logger.info('Generate request', {
      requestId,
      district: inputs.districtName,
      reportTypes: inputs.reportTypes,
      sigmaFileCount: inputs.sigmaTables.length,
      hasGong: !!inputs.gong,
      hasChecklist: !!inputs.checklistTable,
    });

    const normalizedPayload = normalizeInputs(
      inputs.districtName,
      inputs.campaignName,
      inputs.fastFacts,
      inputs.sigmaTables,
      inputs.gong,
      inputs.checklistTable,
    );

    const { report: llmReport, usedMock, provider, llmMs, error: llmError } = await callLLM(normalizedPayload, inputs.reportTypes);

    const totalMs = Date.now() - totalStart;

    // Build canonical response shape
    const now = new Date().toISOString();

    // Spotlight: never null when requested — return empty onePage at minimum
    const spotlightRequested = inputs.reportTypes.includes('spotlight');
    const spotlightOnePage = llmReport.spotlight?.onePage ?? (spotlightRequested ? {} : null);

    const response: ApiResponse = {
      ok: true,
      report: {
        internalDeck: llmReport.internal
          ? { slides: llmReport.internal.slides }
          : null,
        spotlight: spotlightOnePage !== null
          ? { onePage: spotlightOnePage }
          : null,
        diagnostics: llmReport.diagnostics,
      },
      recap: {
        title: llmReport.story?.title ?? `${inputs.districtName} Recap`,
        districtName: llmReport.story?.districtName ?? inputs.districtName,
        generatedAt: llmReport.story?.generatedAt ?? now,
        frames: llmReport.story?.frames ?? [],
        allowedDomains: normalizedPayload.derived.allowedDomains,
      },
      diagnostics: {
        usedMock,
        provider,
        requestedTypes: inputs.reportTypes,
        requestId,
        timingsMs: { parse: parseMs, llm: llmMs, total: totalMs },
        ...(llmError ? { error: llmError } : {}),
      },
    };

    logger.info('Generate complete', {
      requestId,
      district: inputs.districtName,
      provider,
      usedMock,
      timingsMs: response.diagnostics.timingsMs,
    });

    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Generate failed', { requestId, error: message });
    res.status(500).json({ ok: false, error: message, diagnostics: { requestId } });
  }
});

// ── POST /parse-only ───────────────────────────────────────────────
router.post('/parse-only', uploadFields, requireToken, requireDistrictName, async (req: Request, res: Response) => {
  try {
    const inputs = await parseRequestInputs(req);

    const normalizedPayload: NormalizedPayload = normalizeInputs(
      inputs.districtName,
      inputs.campaignName,
      inputs.fastFacts,
      inputs.sigmaTables,
      inputs.gong,
      inputs.checklistTable,
    );

    res.json({
      ok: true,
      normalizedPayload,
      note: 'This is the payload that would be sent to the LLM. No LLM call was made.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Parse-only failed', { error: message });
    res.status(500).json({ ok: false, error: message });
  }
});

export default router;
