import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { muralClient, MuralTransaction } from '../lib/mural';
import { getEnv } from '../schemas/env';

const router = Router();

// The "Accounts Receivable" account (API-enabled) that customers pay into.
const MURAL_ACCOUNT_ID = '4d510319-935a-4001-84e2-4ebf4f243e40';

/**
 * Filters for incoming USDC deposits that do not have an order matched to them.
 *
 * @note Shortcomings:
 * - Erroneous deposits will never be filtered out from the results
 *
 * @param transactions - All transactions from the MuralPay API
 * @returns Unmatched USDC deposits
 */
async function filterUnmatchedDeposits(
  transactions: MuralTransaction[]
): Promise<MuralTransaction[]> {
  // Filter for incoming USDC deposits
  const deposits = transactions.filter((tx) => {
    return (
      tx.transactionDetails.type === 'deposit' &&
      tx.transactionDetails.details?.type === 'blockchain' &&
      tx.transactionDetails.details?.blockchain === 'POLYGON' &&
      tx.amount.tokenSymbol === 'USDC'
    );
  });

  const depositIds = deposits.map((tx) => tx.id);

  // Get all transaction IDs from Order table
  const matchedOrders = await prisma.order.findMany({
    where: { muralTransactionId: { in: depositIds } },
  });

  const matchedTxIds = new Set(matchedOrders.map((o) => o.muralTransactionId));

  // Return deposits that do not have an order matched to them
  return deposits.filter((tx) => !matchedTxIds.has(tx.id));
}

// GET /cron/check-payments
// Called by Vercel Cron Jobs on a schedule (vercel.json).
// Detects incoming USDC deposits, matches them to pending orders, and
// triggers a COP payout for each matched order.
// NOTE: Will not trigger a COP payout unless there are pending orders to match to.
router.get('/check-payments', async (req, res) => {
  const env = getEnv();

  // Case: cron secret mismatch, return 401
  if (req.headers.authorization !== `Bearer ${env.CRON_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Fetch all pending orders
  const pendingOrders = await prisma.order.findMany({
    where: { status: 'PENDING_PAYMENT' },
  });

  console.log(`Found ${pendingOrders.length} pending orders`);
  console.log(JSON.stringify(pendingOrders, null, 2));

  // Case: no pending orders, return
  // NOTE: even if we have a new payment, we should not process it until we have an order to match it to
  if (pendingOrders.length === 0) {
    res.json({ message: 'No pending orders', matched: 0 });
    return;
  }

  // Fetch recent incoming USDC blockchain deposits from MuralPay API
  // NOTE: This will always fetch all transactions, we could more cleverly fetch in the future
  const { results: transactions } =
    await muralClient.transactions.search(MURAL_ACCOUNT_ID);

  const unmatchedDeposits = await filterUnmatchedDeposits(transactions);

  console.log(`Found ${unmatchedDeposits.length} unmatched deposits`);
  console.log(JSON.stringify(unmatchedDeposits, null, 2));

  // Case: no unmatched transactions, no new deposits, return
  if (unmatchedDeposits.length === 0) {
    res.json({ message: 'No new deposits', matched: 0 });
    return;
  }

  let matched = 0;

  for (const tx of unmatchedDeposits) {
    // Find the first pending order whose total matches this deposit amount.
    // Pitfall: two orders with the same total are ambiguous, first one wins.
    // Pitfall: Only exact matches are considered
    const matchedOrder = pendingOrders.find((order) => {
      // Case: order already matched to a deposit, continue
      if (order.muralTransactionId !== null) return false;

      // Check for an exact match between order total and deposit amount
      return order.totalUsdc === tx.amount.tokenAmount;
    });

    // Case: no matching order, continue
    if (!matchedOrder) continue;

    // Mark the order as matched so we don't re-use it in this run
    matchedOrder.muralTransactionId = tx.id;

    const usdcAmount = tx.amount.tokenAmount;

    try {
      // Mark order as PAID
      await prisma.order.update({
        where: { id: matchedOrder.id },
        data: {
          status: 'PAID',
          muralTransactionId: tx.id,
          paidAt: new Date(),
        },
      });

      // Create conversion record
      const conversion = await prisma.conversion.create({
        data: {
          orderId: matchedOrder.id,
          usdcAmount,
          status: 'PENDING',
        },
      });

      // MuralPay expects human-readable USDC, not raw units
      const payoutRequest = await muralClient.payouts.create(
        MURAL_ACCOUNT_ID,
        usdcAmount,
        `Order ${matchedOrder.id}`
      );

      await muralClient.payouts.execute(payoutRequest.id);

      const copAmount =
        payoutRequest.payouts[0]?.details?.fiatAmount?.fiatAmount;

      await prisma.conversion.update({
        where: { id: conversion.id },
        data: {
          muralPayoutRequestId: payoutRequest.id,
          status: 'INITIATED',
          ...(copAmount !== undefined && { copAmount }),
        },
      });

      matched++;
    } catch (err) {
      console.error(
        `Failed to process payment for order ${matchedOrder.id}:`,
        err
      );
      // Leave order as PAID so it can be retried / investigated
    }
  }

  res.json({ message: 'Payment check complete', matched });
});

export default router;
