import { Router, Request, Response } from 'express';
import { requireToken } from '../utils/validate';
import { logger } from '../utils/logger';
import { isGongConfigured, testConnection, getAllCalls, getCallTranscript } from '../services/gongApi';

const router = Router();

// ── GET /gong/status ─────────────────────────────────────────────────
// Quick check: are Gong credentials configured and valid?
router.get('/gong/status', requireToken, async (_req: Request, res: Response) => {
  if (!isGongConfigured()) {
    res.json({ ok: true, configured: false });
    return;
  }

  const connected = await testConnection();
  res.json({ ok: true, configured: true, connected });
});

// ── GET /gong/calls ──────────────────────────────────────────────────
// List recent calls. Query params: ?from=ISO&to=ISO (optional, default 30 days).
router.get('/gong/calls', requireToken, async (req: Request, res: Response) => {
  if (!isGongConfigured()) {
    res.status(400).json({ ok: false, error: 'Gong API credentials not configured' });
    return;
  }

  try {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const calls = await getAllCalls(from, to);

    res.json({ ok: true, calls });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to fetch Gong calls', { error: message });
    res.status(502).json({ ok: false, error: message });
  }
});

// ── GET /gong/calls/:id/transcript ───────────────────────────────────
router.get('/gong/calls/:id/transcript', requireToken, async (req: Request, res: Response) => {
  if (!isGongConfigured()) {
    res.status(400).json({ ok: false, error: 'Gong API credentials not configured' });
    return;
  }

  try {
    const transcript = await getCallTranscript(req.params.id);
    if (!transcript) {
      res.status(404).json({ ok: false, error: 'Transcript not found' });
      return;
    }
    res.json({ ok: true, transcript });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to fetch Gong transcript', { error: message, callId: req.params.id });
    res.status(502).json({ ok: false, error: message });
  }
});

export default router;
