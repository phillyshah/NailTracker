import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as ctrl from '../controllers/audit.controller.js';

const router = Router();

router.use(authMiddleware);

// Cycle Count is available to admins and to distributor accounts (the latter are
// scoped to their own distributor — enforced in each handler).
function adminOrDistributor(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'admin' || req.user?.role === 'distributor') return next();
  return res.status(403).json({ success: false, error: 'Access denied' });
}
router.use(adminOrDistributor);

router.get('/', ctrl.list);
router.post('/preview', ctrl.preview);
router.post('/commit', ctrl.commit);

export default router;
