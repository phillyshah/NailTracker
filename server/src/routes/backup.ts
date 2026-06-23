import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import * as ctrl from '../controllers/backup.controller.js';

const router = Router();

// Inventory Backup is a TrackerLabs (admin-only) feature.
router.use(authMiddleware);
router.use(adminOnly);

router.get('/excel', ctrl.exportBackupExcel);
router.get('/json', ctrl.exportBackupJson);

export default router;
