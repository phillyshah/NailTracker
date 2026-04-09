import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import * as ctrl from '../controllers/inventory.controller.js';

const router = Router();

router.use(authMiddleware);

const scanSchema = z.object({
  barcode: z.string().min(1, 'Barcode is required'),
  imageData: z.string().optional(),
});

const parseSchema = z.object({
  barcodes: z.array(z.string().min(1)).min(1, 'At least one barcode is required'),
});

const assignSchema = z.object({
  items: z.array(
    z.object({
      gtin: z.string(),
      gtinShort: z.string(),
      lot: z.string(),
      expDate: z.string().nullable().optional(),
      udi: z.string(),
      rawBarcode: z.string(),
      productLabel: z.string(),
    }),
  ).min(1, 'At least one item is required'),
  distributorId: z.string().nullable().optional(),
  imageData: z.string().optional(),
});

const reassignSchema = z.object({
  distributorId: z.string().nullable().optional(),
  note: z.string().optional(),
});

router.post('/scan', validate(scanSchema), ctrl.scan);
router.post('/parse', validate(parseSchema), ctrl.parse);
router.post('/assign', validate(assignSchema), ctrl.assign);
router.get('/', ctrl.list);
router.get('/:udi', ctrl.getOne);
router.patch('/:udi/reassign', validate(reassignSchema), ctrl.reassign);
router.patch('/:udi/use', ctrl.markUsed);
router.delete('/:udi', ctrl.remove);

export default router;
