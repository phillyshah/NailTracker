import { Router } from 'express';
import { authMiddleware as auth } from '../middleware/auth.js';
import { create, list, getOne, previewBatch } from '../controllers/transfer.controller.js';

const router = Router();
router.use(auth);

router.post('/', create);
router.post('/preview-batch', previewBatch);
router.get('/', list);
router.get('/:transferId', getOne);

export default router;
