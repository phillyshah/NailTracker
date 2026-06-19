import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import * as ctrl from '../controllers/holdings.controller.js';

const router = Router();

// Who Has What is a TrackerLabs (admin-only) feature.
router.use(authMiddleware);
router.use(adminOnly);

router.get('/', ctrl.holdingsReport);
router.get('/export', ctrl.exportHoldings);

export default router;
