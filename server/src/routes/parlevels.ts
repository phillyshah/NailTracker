import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as ctrl from '../controllers/parlevel.controller.js';

const router = Router();

router.use(authMiddleware);

// Par Levels is a TrackerLabs (admin-only) feature.
function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}
router.use(adminOnly);

router.get('/', ctrl.list);
router.put('/', ctrl.upsert);
router.get('/reorder', ctrl.reorderReport);
router.get('/reorder/export', ctrl.exportReorder);

export default router;
