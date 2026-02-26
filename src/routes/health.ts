import { Router, Request, Response } from 'express';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    version: '1.0.0',
    time: new Date().toISOString(),
  });
});

export default router;
