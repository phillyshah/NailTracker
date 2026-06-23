import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import * as ctrl from '../controllers/parlevel.controller.js';

const router = Router();

// Par Levels is a TrackerLabs (admin-only) feature.
router.use(authMiddleware);
router.use(adminOnly);

router.get('/', ctrl.list);
router.put('/', ctrl.upsert);
router.get('/reorder', ctrl.reorderReport);
router.get('/reorder/export', ctrl.exportReorder);

export default router;
