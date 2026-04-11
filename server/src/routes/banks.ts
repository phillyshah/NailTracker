import { Router } from 'express';
import { authMiddleware as auth } from '../middleware/auth.js';
import { list, getOne, create, update, remove, addItems, removeItems, transferBank } from '../controllers/bank.controller.js';

const router = Router();
router.use(auth);

router.get('/', list);
router.get('/:id', getOne);
router.post('/', create);
router.patch('/:id', update);
router.delete('/:id', remove);
router.post('/:id/add', addItems);
router.post('/:id/remove', removeItems);
router.post('/:id/transfer', transferBank);

export default router;
