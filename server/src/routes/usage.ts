import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware as auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { preview, commit, list, getOne } from '../controllers/usage.controller.js';

const router = Router();
router.use(auth);

const previewSchema = z.object({
  distributorId: z.string().min(1, 'Distributor is required'),
  barcodes: z.array(z.string().min(1)).min(1, 'At least one barcode is required'),
});

const commitSchema = z.object({
  distributorId: z.string().min(1, 'Distributor is required'),
  itemIds: z.array(z.string().min(1)).min(1, 'At least one item is required'),
  note: z.string().optional(),
});

router.post('/preview', validate(previewSchema), preview);
router.post('/commit', validate(commitSchema), commit);
router.get('/', list);
router.get('/:ticketId', getOne);

export default router;
