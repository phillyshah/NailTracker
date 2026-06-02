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

const parseSpreadsheetSchema = z.object({
  fileName: z.string().optional(),
  dataBase64: z.string().min(1, 'File data is required'),
});

const scanManualSchema = z.object({
  itemNumber: z.string().min(1, 'Item number is required'),
  lot: z.string().min(1, 'Lot number is required'),
  expDate: z.string().nullable().optional(),
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
      imageData: z.string().optional(),
    }),
  ).min(1, 'At least one item is required'),
  distributorId: z.string().nullable().optional(),
  imageData: z.string().optional(),
});

const reassignSchema = z.object({
  distributorId: z.string().nullable().optional(),
  note: z.string().optional(),
  skipTransferRecord: z.boolean().optional(),
});

const editSchema = z.object({
  gtin: z.string().optional(),
  lot: z.string().optional(),
  expDate: z.string().nullable().optional(),
  itemNumber: z.string().optional(),
  productLabel: z.string().optional(),
});

router.post('/scan', validate(scanSchema), ctrl.scan);
router.post('/scan-manual', validate(scanManualSchema), ctrl.scanManual);
router.post('/parse', validate(parseSchema), ctrl.parse);
router.post('/parse-spreadsheet', validate(parseSpreadsheetSchema), ctrl.parseSpreadsheet);
router.post('/assign', validate(assignSchema), ctrl.assign);
router.post('/backfill-expiry', ctrl.backfillExpiry);
router.post('/backfill-labels', ctrl.backfillLabels);
router.post('/backfill-manual-expiry', ctrl.backfillManualExpiry);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.patch('/:id/reassign', validate(reassignSchema), ctrl.reassign);
router.patch('/:id/edit', validate(editSchema), ctrl.edit);
router.patch('/:id/use', ctrl.markUsed);
router.delete('/:id', ctrl.remove);

export default router;
