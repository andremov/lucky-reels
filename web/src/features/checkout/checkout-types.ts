// Shapes frozen by docs/api-contract.md. All money is integer cents in COP.

export type Money = number;

export type Product = {
  id: string;
  name: string;
  description: string;
  priceCents: Money;
  currency: string;
  imageUrl: string;
  spinsGranted: number;
  stock: { available: number };
};

/** Server-computed. Never re-derive or sum these client-side. */
export type Amounts = {
  productCents: Money;
  baseFeeCents: Money;
  deliveryFeeCents: Money;
  totalCents: Money;
  currency: string;
};

export type Customer = {
  email: string;
  fullName: string;
  phone: string;
};

export type Delivery = {
  addressLine: string;
  city: string;
  region: string;
  postalCode: string;
};

export const TRANSACTION_STATUSES = ['PENDING', 'APPROVED', 'DECLINED', 'ERROR'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/** The contract says to treat anything unrecognised as ERROR. */
export function normalizeStatus(value: unknown): TransactionStatus {
  return TRANSACTION_STATUSES.includes(value as TransactionStatus)
    ? (value as TransactionStatus)
    : 'ERROR';
}

export function isTerminal(status: TransactionStatus): boolean {
  return status !== 'PENDING';
}

export type CreateTransactionInput = {
  productId: string;
  quantity: number;
  customer: Customer;
  delivery: Delivery;
};

export type CreatedTransaction = {
  reference: string;
  status: TransactionStatus;
  amounts: Amounts;
  expiresAt: string;
};

export type TransactionView = {
  reference: string;
  status: TransactionStatus;
  amounts: Amounts;
  product: { id: string; name: string; spinsGranted: number };
  /** Present only on APPROVED. */
  creditsGranted?: number;
  playerToken?: string;
  settledAt?: string;
};

export type PayInput = {
  paymentToken: string;
  /** Optional: the API fetches the acceptance token server-side. */
  acceptanceToken?: string;
  installments: number;
};

export type DeliveryView = {
  reference: string;
  addressLine: string;
  city: string;
  region: string;
  postalCode: string;
  feeCents: Money;
  status: string;
};

export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'PRODUCT_NOT_FOUND'
  | 'OUT_OF_STOCK'
  | 'TRANSACTION_NOT_FOUND'
  | 'TRANSACTION_ALREADY_SETTLED'
  | 'TRANSACTION_EXPIRED'
  | 'PAYMENT_REJECTED'
  | 'DELIVERY_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'INSUFFICIENT_CREDITS'
  | 'INTERNAL_ERROR';

export type FieldError = { field: string; message: string };

/** Switch on `code`, never on `message`. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: FieldError[];

  constructor(code: ApiErrorCode, message: string, status = 0, details: FieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
