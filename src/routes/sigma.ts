import { Router, Request, Response } from 'express';
import { requireToken } from '../utils/validate';
import { logger } from '../utils/logger';
import {
  isSigmaConfigured,
  testConnection,
  discoverWorkbook,
  pullDistrictData,
  getDistrictNames,
} from '../services/sigmaApi';
import { cacheSigmaTables, getCachedSigmaTables } from '../services/sigmaCache';

const router = Router();

// ── GET /sigma/status ────────────────────────────────────────────────
// Quick check: are Sigma credentials configured and valid?
router.get('/sigma/status', requireToken, async (_req: Request, res: Response) => {
  if (!isSigmaConfigured()) {
    res.json({ ok: true, configured: false });
    return;
  }

  const result = await testConnection();
  res.json({ ok: true, configured: true, connected: result.ok, error: result.error });
});

// ── GET /sigma/discover ──────────────────────────────────────────────
// List workbook pages, elements, and their IDs. Useful for finding
// element IDs and the district control ID without needing Sigma edit access.
router.get('/sigma/discover', requireToken, async (_req: Request, res: Response) => {
  if (!isSigmaConfigured()) {
    res.status(400).json({ ok: false, error: 'Sigma API credentials not configured' });
    return;
  }

  try {
    const workbook = await discoverWorkbook();
    res.json({ ok: true, ...workbook });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Sigma discover failed', { error: message });
    res.status(502).json({ ok: false, error: message });
  }
});

// ── POST /sigma/pull ─────────────────────────────────────────────────
// Pull all district data from the Sigma workbook. Body: { districtName: string }
router.post('/sigma/pull', requireToken, async (req: Request, res: Response) => {
  if (!isSigmaConfigured()) {
    res.status(400).json({ ok: false, error: 'Sigma API credentials not configured' });
    return;
  }

  const { districtName } = req.body;
  if (!districtName || typeof districtName !== 'string') {
    res.status(400).json({ ok: false, error: 'districtName is required' });
    return;
  }

  try {
    const tables = await pullDistrictData(districtName.trim());

    // Cache full tables so /generate can use them without re-upload
    cacheSigmaTables(districtName.trim(), tables);

    // Return metadata to frontend (no need to send full data back)
    res.json({
      ok: true,
      tables: tables.map(t => ({
        tableId: t.tableId,
        filename: t.filename,
        tableType: t.tableType,
        headers: t.headers,
        rowCount: t.rowCount,
        sampleRows: t.sampleRows,
      })),
      count: tables.length,
      tableTypes: tables.map(t => t.tableType),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Sigma pull failed', { error: message, districtName });
    res.status(502).json({ ok: false, error: message });
  }
});

// ── GET /sigma/districts ──────────────────────────────────────────────
// Return the list of valid district names from the Sigma workbook.
router.get('/sigma/districts', requireToken, async (_req: Request, res: Response) => {
  if (!isSigmaConfigured()) {
    res.status(400).json({ ok: false, error: 'Sigma API credentials not configured' });
    return;
  }

  try {
    const districts = await getDistrictNames();
    res.json({ ok: true, districts });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Sigma districts fetch failed', { error: message });
    res.status(502).json({ ok: false, error: message });
  }
});

// ── GET /sigma/cache/:district/:filename ──────────────────────────────
// Download a cached Sigma CSV file for inspection.
router.get('/sigma/cache/:district/:filename', requireToken, (req: Request, res: Response) => {
  const { district, filename } = req.params;
  const tables = getCachedSigmaTables(district);
  if (!tables) {
    res.status(404).json({ ok: false, error: 'No cached data for this district' });
    return;
  }

  const table = tables.find(t => t.filename === filename);
  if (!table) {
    res.status(404).json({ ok: false, error: 'Table not found in cache' });
    return;
  }

  // Reconstruct CSV from rawRows
  const rows = table.rawRows ?? table.sampleRows ?? [];
  const csv = [
    table.headers.join(','),
    ...rows.map((row: Record<string, string>) =>
      table.headers.map((h: string) => {
        const val = row[h] ?? '';
        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(',')
    ),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

export default router;
