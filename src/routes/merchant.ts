import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { muralClient } from '../lib/mural';
import { merchantAuth } from '../lib/middleware/merchantAuth';

const router = Router();

router.use(merchantAuth);

// GET /merchant/orders — all orders with payment status
router.get('/orders', async (_req, res) => {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      customer: true,
      products: { include: { product: true } },
      conversion: true,
    },
  });
  res.json({ orders });
});

// GET /merchant/payouts — all COP conversion records, refreshed from MuralPay
router.get('/payouts', async (_req, res) => {
  const conversions = await prisma.conversion.findMany({
    orderBy: { createdAt: 'desc' },
    include: { order: { include: { customer: true } } },
  });

  // Refresh status from MuralPay for any in-flight conversions
  await Promise.all(
    conversions
      .filter((c) => c.status === 'INITIATED' && c.muralPayoutRequestId)
      .map(async (c) => {
        if (!c.muralPayoutRequestId) return;

        const payout = await muralClient.payouts.get(c.muralPayoutRequestId);
        const fiatStatus = payout.payouts[0]?.details?.fiatPayoutStatus?.type;

        const newStatus =
          fiatStatus === 'completed'
            ? 'COMPLETED'
            : fiatStatus === 'canceled' ||
                fiatStatus === 'refunded' ||
                fiatStatus === 'refundInProgress'
              ? 'FAILED'
              : null;

        if (!newStatus) return;

        await prisma.conversion.update({
          where: { id: c.id },
          data: { status: newStatus },
        });

        // Keep the local object in sync for the response
        c.status = newStatus;
      })
  );

  res.json({ conversions });
});

export default router;
