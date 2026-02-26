/**
 * POST /export/pptx
 *
 * Accepts report data (the same shape from /generate) and returns a
 * branded PPTX file as a binary download.
 *
 * Body: {
 *   type: "internal" | "spotlight",
 *   districtName: string,
 *   campaignName?: string,
 *   report: { internalDeck?: { slides: ... }, spotlight?: { onePage: ... } }
 * }
 */
import { Router, Request, Response } from 'express';
import { requireToken } from '../utils/validate';
import { logger } from '../utils/logger';
import { generateInternalReport, generateSpotlight } from '../services/pptx';

const router = Router();

router.post('/export/pptx', requireToken, async (req: Request, res: Response) => {
  try {
    const { type, districtName, campaignName, report } = req.body;

    if (!type || !['internal', 'spotlight'].includes(type)) {
      res.status(400).json({ ok: false, error: 'type must be "internal" or "spotlight"' });
      return;
    }

    if (!districtName || typeof districtName !== 'string') {
      res.status(400).json({ ok: false, error: 'districtName is required' });
      return;
    }

    if (!report || typeof report !== 'object') {
      res.status(400).json({ ok: false, error: 'report data is required' });
      return;
    }

    let buffer: Buffer;
    let filename: string;
    const slug = districtName.replace(/\s+/g, '_');

    if (type === 'internal') {
      const slides = report.internalDeck?.slides;
      if (!slides || !Array.isArray(slides) || slides.length === 0) {
        res.status(400).json({ ok: false, error: 'No internal deck slides found in report data' });
        return;
      }

      buffer = await generateInternalReport({ districtName, campaignName, slides });
      filename = `${slug}_Internal_Adoption_Report.pptx`;
    } else {
      const onePage = report.spotlight?.onePage;
      if (!onePage || typeof onePage !== 'object') {
        res.status(400).json({ ok: false, error: 'No spotlight data found in report data' });
        return;
      }

      buffer = await generateSpotlight({ districtName, onePage });
      filename = `${slug}_Customer_Spotlight.pptx`;
    }

    logger.info('PPTX export', { type, districtName, sizeKb: Math.round(buffer.length / 1024) });

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    });

    res.send(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('PPTX export failed', { error: message });
    res.status(500).json({ ok: false, error: `PPTX generation failed: ${message}` });
  }
});

export default router;
