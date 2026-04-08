import { Router } from 'express';
import productsRouter from './products';
import ordersRouter from './orders';
import merchantRouter from './merchant';
import cronRouter from './cron';

const router = Router();

router.use('/products', productsRouter);
router.use('/orders', ordersRouter);
router.use('/merchant', merchantRouter);
router.use('/cron', cronRouter);

export default router;
