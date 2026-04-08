import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /products — get all products
router.get('/', async (_req, res) => {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'asc' },
  });
  res.json({ products });
});

export default router;
