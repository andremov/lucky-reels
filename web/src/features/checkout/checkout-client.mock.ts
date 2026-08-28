import type { CheckoutClient } from './checkout-client';
import {
  ApiError,
  type CreateTransactionInput,
  type CreatedTransaction,
  type Product,
  type TransactionStatus,
  type TransactionView,
} from './checkout-types';

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'prd_starter',
    name: 'Starter Pack',
    description: '20 spins on the Lucky Reels machine',
    priceCents: 2000000,
    currency: 'COP',
    imageUrl: 'https://placehold.co/320x200?text=Starter',
    spinsGranted: 20,
    stock: { available: 7 },
  },
  {
    id: 'prd_high_roller',
    name: 'High Roller Pack',
    description: '100 spins, for the brave',
    priceCents: 9000000,
    currency: 'COP',
    imageUrl: 'https://placehold.co/320x200?text=High+Roller',
    spinsGranted: 100,
    stock: { available: 2 },
  },
];

/** jsdom lacks structuredClone; these payloads are plain JSON, so this suffices. */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const BASE_FEE_CENTS = 150000;
const DELIVERY_FEE_CENTS = 80000;

export type MockOptions = {
  /** What the transaction settles to once `pay` is called. */
  outcome?: TransactionStatus;
  /** Polls to stay PENDING before settling, so the UI's polling is exercised. */
  pendingPolls?: number;
  products?: Product[];
};

/**
 * In-memory stand-in for the API. Deliberately reproduces the server-side
 * behaviour the UI depends on: the server computes fees, `reference` is
 * idempotent, and stock moves as reservations are taken and released.
 */
export function createMockCheckoutClient(options: MockOptions = {}): CheckoutClient {
  const { outcome = 'APPROVED', pendingPolls = 0 } = options;
  const products = clone(options.products ?? MOCK_PRODUCTS);

  const transactions = new Map<
    string,
    { view: TransactionView; productId: string; quantity: number; pollsLeft: number; paid: boolean }
  >();
  let counter = 0;

  const find = (id: string) => products.find((p) => p.id === id);

  return {
    async listProducts() {
      return clone(products);
    },

    async getProduct(id) {
      const product = find(id);
      if (!product) throw new ApiError('PRODUCT_NOT_FOUND', 'No such product', 404);
      return clone(product);
    },

    async createTransaction(input: CreateTransactionInput): Promise<CreatedTransaction> {
      const product = find(input.productId);
      if (!product) throw new ApiError('PRODUCT_NOT_FOUND', 'No such product', 404);
      if (product.stock.available < input.quantity) {
        throw new ApiError('OUT_OF_STOCK', `Only ${product.stock.available} packs left`, 409);
      }

      // Reserve immediately, exactly like the server.
      product.stock.available -= input.quantity;

      counter += 1;
      const reference = `LR-MOCK${String(counter).padStart(4, '0')}`;
      const productCents = product.priceCents * input.quantity;
      const amounts = {
        productCents,
        baseFeeCents: BASE_FEE_CENTS,
        deliveryFeeCents: DELIVERY_FEE_CENTS,
        totalCents: productCents + BASE_FEE_CENTS + DELIVERY_FEE_CENTS,
        currency: product.currency,
      };

      transactions.set(reference, {
        productId: product.id,
        quantity: input.quantity,
        pollsLeft: pendingPolls,
        paid: false,
        view: {
          reference,
          status: 'PENDING',
          amounts,
          product: { id: product.id, name: product.name, spinsGranted: product.spinsGranted },
        },
      });

      return {
        reference,
        status: 'PENDING',
        amounts,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };
    },

    async pay(reference) {
      const record = transactions.get(reference);
      if (!record) throw new ApiError('TRANSACTION_NOT_FOUND', 'Unknown reference', 404);

      // Idempotent: a retry reports the current state, it does not charge again.
      if (record.view.status !== 'PENDING') {
        return { reference, status: record.view.status };
      }

      record.paid = true;
      return { reference, status: 'PENDING' };
    },

    async getTransaction(reference) {
      const record = transactions.get(reference);
      if (!record) throw new ApiError('TRANSACTION_NOT_FOUND', 'Unknown reference', 404);

      if (record.paid && record.view.status === 'PENDING') {
        if (record.pollsLeft > 0) {
          record.pollsLeft -= 1;
        } else {
          record.view.status = outcome;
          record.view.settledAt = new Date().toISOString();

          const product = find(record.productId);
          if (outcome === 'APPROVED') {
            record.view.creditsGranted = record.view.product.spinsGranted * record.quantity;
            record.view.playerToken = `plr_mock_${reference}`;
          } else if (product) {
            // DECLINED / ERROR release the reservation back to the pool.
            product.stock.available += record.quantity;
          }
        }
      }

      return clone(record.view);
    },

    async getDelivery(reference) {
      const record = transactions.get(reference);
      if (!record || record.view.status !== 'APPROVED') {
        throw new ApiError('DELIVERY_NOT_FOUND', 'Not assigned yet', 404);
      }
      return {
        reference,
        addressLine: 'Calle 1 # 2-3',
        city: 'Bogota',
        region: 'Cundinamarca',
        postalCode: '110111',
        feeCents: DELIVERY_FEE_CENTS,
        status: 'ASSIGNED',
      };
    },
  };
}
