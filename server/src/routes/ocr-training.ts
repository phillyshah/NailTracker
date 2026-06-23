import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import * as ctrl from '../controllers/ocrTraining.controller.js';

const router = Router();

router.use(authMiddleware);

// The alias overlay feeds the OCR matcher, which every scanning user relies on —
// so reading it is open to any authenticated account. Everything below is the
// admin-only training surface.
router.get('/aliases', ctrl.listAliases);

router.use(adminOnly);

router.get('/', ctrl.listSamples);
router.get('/export-fixtures', ctrl.exportFixtures);
router.get('/:id', ctrl.getSample);
router.post('/', ctrl.createSample);
router.patch('/:id', ctrl.updateSample);
router.delete('/:id', ctrl.deleteSample);

export default router;
