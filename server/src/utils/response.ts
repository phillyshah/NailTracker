import type { Response } from 'express';

interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
}

export function success<T>(res: Response, data: T, meta?: ApiMeta, status = 200) {
  return res.status(status).json({ success: true, data, meta });
}

export function error(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

/** Safely extract a string from Express 5 param/query */
export function str(val: unknown): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return str(val[0]);
  return '';
}
