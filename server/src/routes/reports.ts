import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as ctrl from '../controllers/reports.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/summary', ctrl.summary);
router.get('/expiring', ctrl.expiring);
router.get('/distributor-counts', ctrl.distributorCounts);
router.get('/distributor/:id', ctrl.distributorReport);
router.get('/export', ctrl.exportCsv);

export default router;
