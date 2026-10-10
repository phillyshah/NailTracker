import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import * as ctrl from '../controllers/orderplan.controller.js';

const router = Router();

// The Order Planner is a TrackerLabs (admin-only) feature, like Par Levels.
router.use(authMiddleware);
router.use(adminOnly);

router.get('/', ctrl.plan);
router.get('/basis', ctrl.basis);
router.get('/export', ctrl.exportPlan);
router.get('/open-orders', ctrl.listOpenOrders);
router.put('/open-orders', ctrl.upsertOpenOrder);

export default router;
