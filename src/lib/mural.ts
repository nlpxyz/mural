import { getEnv } from '../schemas/env';

// On-chain wallet address for the "Accounts Receivable" MuralPay account.
// Customers send USDC here on Polygon Amoy.
export const DEPOSIT_WALLET = '0x61ef58e23439B861B6dB5085796ff726f6B521F7';

// Hardcoded COP recipient — matches the Nequi external account linked in the
// MuralPay platform (that account isn't exposed via the counterparties API,
// so we use the inline payout approach with these details).
const COP_RECIPIENT = {
  bankName: 'Nequi',
  bankAccountOwner: 'Colombian Nicolas',
  fiatAndRailDetails: {
    type: 'cop' as const,
    symbol: 'COP' as const,
    phoneNumber: '+15866510579',
    accountType: 'SAVINGS' as const,
    bankAccountNumber: '1234567890',
    documentNumber: '12345678',
    documentType: 'NATIONAL_ID' as const,
  },
  recipientInfo: {
    type: 'individual' as const,
    firstName: 'Colombian',
    lastName: 'Nicolas',
    email: 'nick@example.com',
    physicalAddress: {
      address1: 'Calle 123 #45-67',
      country: 'CO',
      state: 'DC',
      city: 'Bogota',
      zip: '110111',
    },
  },
};

/**
 * Base fetch wrapper for the MuralPay staging API.
 *
 * All requests are authenticated with the standard API key via the
 * `Authorization: Bearer` header. For endpoints that execute or cancel
 * transactions (`/payouts/payout/execute`, `/payouts/payout/cancel`),
 * the Transfer API key must also be included via the `transfer-api-key`
 * header — pass `useTransferKey: true` for those calls.
 */
async function muralFetch<T>(
  path: string,
  options: RequestInit = {},
  useTransferKey = false
): Promise<T> {
  const env = getEnv();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.MURAL_API_KEY}`,
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (useTransferKey) {
    headers['transfer-api-key'] = env.MURAL_TRANSFER_API_KEY;
  }

  const res = await fetch(`https://api-staging.muralpay.com${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MuralPay ${res.status} ${path}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export interface MuralTransaction {
  id: string;
  transactionExecutionDate: string;
  amount: { tokenAmount: number; tokenSymbol: string };
  transactionDetails: {
    type: 'deposit' | 'payout' | 'externalPayout' | 'refundedPayout';
    details?: {
      type: 'blockchain' | 'fiat';
      senderAddress?: string;
      blockchain?: string;
    };
  };
}

export interface MuralPayoutRequest {
  id: string;
  status: string;
  createdAt: string;
  payouts: Array<{
    id: string;
    details: {
      fiatPayoutStatus?: { type: string };
      fiatAmount?: { fiatAmount: number; fiatCurrencyCode: string };
    };
  }>;
}

export const muralClient = {
  transactions: {
    search: (accountId: string) =>
      muralFetch<{ results: MuralTransaction[] }>(
        `/api/transactions/search/account/${accountId}`,
        { method: 'POST', body: '{}' }
      ),
  },

  payouts: {
    create: (sourceAccountId: string, usdcAmount: number, memo: string) =>
      muralFetch<MuralPayoutRequest>(
        '/api/payouts/payout',
        {
          method: 'POST',
          body: JSON.stringify({
            sourceAccountId,
            memo,
            payouts: [
              {
                amount: { tokenAmount: usdcAmount, tokenSymbol: 'USDC' },
                payoutDetails: {
                  type: 'fiat',
                  bankName: COP_RECIPIENT.bankName,
                  bankAccountOwner: COP_RECIPIENT.bankAccountOwner,
                  fiatAndRailDetails: COP_RECIPIENT.fiatAndRailDetails,
                },
                recipientInfo: COP_RECIPIENT.recipientInfo,
              },
            ],
          }),
        },
        true
      ),

    execute: (payoutRequestId: string) =>
      muralFetch<MuralPayoutRequest>(
        `/api/payouts/payout/${payoutRequestId}/execute`,
        { method: 'POST' },
        true
      ),

    get: (payoutRequestId: string) =>
      muralFetch<MuralPayoutRequest>(`/api/payouts/payout/${payoutRequestId}`),

    search: () =>
      muralFetch<{ results: MuralPayoutRequest[] }>('/api/payouts/search', {
        method: 'POST',
        body: '{}',
      }),
  },
};
