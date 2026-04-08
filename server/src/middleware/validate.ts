import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export function validate<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(', ');
      res.status(400).json({ success: false, error: messages });
      return;
    }
    req.body = result.data;
    next();
  };
}
