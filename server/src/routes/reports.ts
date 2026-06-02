import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as ctrl from '../controllers/reports.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/summary', ctrl.summary);
router.get('/expiring', ctrl.expiring);
router.get('/distributor-counts', ctrl.distributorCounts);
router.get('/distributor/:id', ctrl.distributorReport);
router.get('/stock-by-item', ctrl.stockByItem);
router.get('/stock-by-item/export', ctrl.exportStockByItem);
router.get('/usage-trends', ctrl.usageTrends);
router.get('/usage-trends/export', ctrl.exportUsageTrends);
router.get('/usage-matrix', ctrl.usageMatrix);
router.get('/usage-matrix/export', ctrl.exportUsageMatrix);
router.get('/monthly-usage', ctrl.monthlyUsage);
router.get('/monthly-usage/export', ctrl.exportMonthlyUsage);
router.get('/export', ctrl.exportExcel);

export default router;
