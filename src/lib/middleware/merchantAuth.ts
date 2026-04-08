import { Request, Response, NextFunction } from 'express';
import { getEnv } from '../../schemas/env';

export function merchantAuth(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-api-key'];
  if (key !== getEnv().MERCHANT_API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
