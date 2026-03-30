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
    res.json({
      ok: true,
      tables,
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

export default router;
