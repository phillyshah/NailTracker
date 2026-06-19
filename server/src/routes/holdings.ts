import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as ctrl from '../controllers/holdings.controller.js';

const router = Router();

router.use(authMiddleware);

// Who Has What is a TrackerLabs (admin-only) feature.
function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}
router.use(adminOnly);

router.get('/', ctrl.holdingsReport);
router.get('/export', ctrl.exportHoldings);

export default router;
