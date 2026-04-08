import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { DEPOSIT_WALLET } from '../lib/mural';
import { Product } from '../generated/prisma';

const router = Router();

const OrderProductSchema = z.object({
  productId: z.number(),
  quantity: z.number().int().min(1),
});

const createOrderSchema = z.object({
  products: z.array(OrderProductSchema).min(1),
});

type OrderProduct = z.infer<typeof OrderProductSchema>;

// POST /orders — create a new order
// Requires x-customer-id header
router.post('/', async (req, res) => {
  const customerId = req.headers['x-customer-id'] as string | undefined;

  // Case: no customer ID, return 400
  if (!customerId) {
    res.status(400).json({ error: 'x-customer-id header is required' });
    return;
  }

  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: 'Invalid request body', details: parsed.error });
    return;
  }

  // Verify all products exist
  const productIds = parsed.data.products.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds.map(Number) } },
  });
  if (products.length !== productIds.length) {
    res.status(400).json({ error: 'One or more products not found' });
    return;
  }

  // Create or get customer
  const customer = await prisma.customer.upsert({
    where: { externalId: customerId },
    update: {},
    create: { externalId: customerId },
  });

  // Create mapping of product ID to products for quick lookup
  const productLookup: Record<string, Product> = {};
  products.forEach((p) => {
    productLookup[p.id] = p;
  });

  // Calculate total USDC amount for the order
  const totalUsdc = parsed.data.products.reduce(
    (sum: number, orderProduct: OrderProduct) => {
      const productId = orderProduct.productId.toString();
      const product = productLookup[productId];

      // Case: product not found, should never happen, return sum;
      if (!product) return sum;

      return sum + product.priceUsdc * orderProduct.quantity;
    },
    0
  );

  // Create order in default pending state
  const order = await prisma.order.create({
    data: {
      customerId: customer.id,
      totalUsdc: totalUsdc,
    },
  });

  // Create order products
  await prisma.orderProduct.createMany({
    data: parsed.data.products.map((p) => ({
      orderId: order.id,
      productId: p.productId,
      quantity: p.quantity,
    })),
  });

  res.status(201).json({
    order,
    payment: {
      depositWallet: DEPOSIT_WALLET,
      amountUsdc: totalUsdc,
      network: 'Polygon Amoy (testnet)',
      token: 'USDC',
    },
  });
});

// GET /orders/:id — get order status
router.get('/:id', async (req, res) => {
  const orderId = parseInt(req.params['id']);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  // Case: order not found, return 404
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  res.json({ orderId, status: order.status });
});

export default router;
