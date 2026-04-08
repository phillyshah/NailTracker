import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import * as ctrl from '../controllers/distributors.controller.js';

const router = Router();

router.use(authMiddleware);

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  region: z.string().optional(),
  contact: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  region: z.string().optional(),
  contact: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  active: z.boolean().optional(),
});

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', validate(createSchema), ctrl.create);
router.patch('/:id', validate(updateSchema), ctrl.update);
router.delete('/:id', ctrl.deactivate);

export default router;
