import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import * as ctrl from '../controllers/users.controller.js';

const router = Router();

router.use(authMiddleware);
router.use(adminOnly);

const createSchema = z.object({
  username: z.string().min(2, 'Username must be at least 2 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'user', 'distributor']).optional(),
  distributorId: z.string().nullable().optional(),
});

const passwordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const roleSchema = z.object({
  role: z.enum(['admin', 'user', 'distributor']),
  distributorId: z.string().nullable().optional(),
});

router.get('/', ctrl.listUsers);
router.post('/', validate(createSchema), ctrl.createUser);
router.patch('/:id/password', validate(passwordSchema), ctrl.updatePassword);
router.patch('/:id/role', validate(roleSchema), ctrl.updateRole);
router.delete('/:id', ctrl.deleteUser);

export default router;
