import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export function requireToken(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string | undefined;
  if (!token || token !== config.internalApiToken) {
    res.status(401).json({ ok: false, error: 'Missing or invalid X-Internal-Token header' });
    return;
  }
  next();
}

export function requireDistrictName(req: Request, res: Response, next: NextFunction): void {
  const districtName = req.body?.districtName;
  if (!districtName || typeof districtName !== 'string' || districtName.trim().length === 0) {
    res.status(400).json({ ok: false, error: 'districtName is required' });
    return;
  }
  next();
}
