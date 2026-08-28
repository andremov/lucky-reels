import { randomBytes } from 'node:crypto';

export const TRANSACTION_STATUSES = ['PENDING', 'APPROVED', 'DECLINED', 'ERROR'] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const BASE_FEE_CENTS = 150_000;
export const DELIVERY_FEE_CENTS = 80_000;

/** How long a reservation is held before the pending transaction lapses. */
export const RESERVATION_MINUTES = 30;

export type Amounts = {
  productCents: number;
  baseFeeCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  currency: 'COP';
};

export type TransactionError =
  | { code: 'PRODUCT_NOT_FOUND'; message: string }
  | { code: 'OUT_OF_STOCK'; message: string; available: number }
  | { code: 'VALIDATION_FAILED'; message: string; details: { field: string; message: string }[] }
  | { code: 'TRANSACTION_NOT_FOUND'; message: string }
  | { code: 'TRANSACTION_ALREADY_SETTLED'; message: string; status: TransactionStatus }
  | { code: 'TRANSACTION_EXPIRED'; message: string }
  | { code: 'PAYMENT_REJECTED'; message: string }
  | { code: 'INTERNAL_ERROR'; message: string };

export type TransactionView = {
  reference: string;
  status: TransactionStatus;
  amounts: Amounts;
  product: { id: string; name: string; spinsGranted: number };
  quantity: number;
  creditsGranted?: number;
  playerToken?: string;
  settledAt?: string;
  expiresAt: string;
};

export function computeAmounts(unitPriceCents: number, quantity: number): Amounts {
  const productCents = unitPriceCents * quantity;

  return {
    productCents,
    baseFeeCents: BASE_FEE_CENTS,
    deliveryFeeCents: DELIVERY_FEE_CENTS,
    totalCents: productCents + BASE_FEE_CENTS + DELIVERY_FEE_CENTS,
    currency: 'COP',
  };
}

/**
 * Short, unambiguous, and unique. It is the idempotency key for the whole flow,
 * so a retried payment settles the same transaction rather than charging twice.
 */
export function generateReference(): string {
  return `LR-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + RESERVATION_MINUTES * 60_000);
}

export function isExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function isTerminal(status: TransactionStatus): boolean {
  return status !== 'PENDING';
}

export const outOfStock = (available: number): TransactionError => ({
  code: 'OUT_OF_STOCK',
  message: available === 0 ? 'Sold out' : `Only ${available} left`,
  available,
});

export const productNotFound = (id: string): TransactionError => ({
  code: 'PRODUCT_NOT_FOUND',
  message: `No product with id ${id}`,
});

export const transactionNotFound = (reference: string): TransactionError => ({
  code: 'TRANSACTION_NOT_FOUND',
  message: `No transaction with reference ${reference}`,
});

export const alreadySettled = (status: TransactionStatus): TransactionError => ({
  code: 'TRANSACTION_ALREADY_SETTLED',
  message: `Transaction is already ${status}`,
  status,
});

export const expired = (): TransactionError => ({
  code: 'TRANSACTION_EXPIRED',
  message: 'The reservation lapsed. Start the purchase again.',
});

export const internalError = (reason: unknown): TransactionError => ({
  code: 'INTERNAL_ERROR',
  message: reason instanceof Error ? reason.message : 'Unexpected failure',
});
