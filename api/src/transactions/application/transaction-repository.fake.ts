import { ok, type Result } from '../../shared/result/result';
import {
  computeAmounts,
  expiryFrom,
  generateReference,
  type TransactionError,
  type TransactionView,
} from '../domain/transaction';
import type { CreateTransactionInput, TransactionRepository } from './transaction-repository';

export const anInput = (
  overrides: Partial<CreateTransactionInput> = {},
): CreateTransactionInput => ({
  productId: 'p1',
  quantity: 1,
  customer: { email: 'a@b.test', fullName: 'Test Person', phone: '+573001234567' },
  delivery: {
    addressLine: 'Calle 1 # 2-3',
    city: 'Bogota',
    region: 'Cundinamarca',
    postalCode: '110111',
  },
  ...overrides,
});

export const aTransaction = (overrides: Partial<TransactionView> = {}): TransactionView => ({
  reference: generateReference(),
  status: 'PENDING',
  amounts: computeAmounts(2_000_000, 1),
  product: { id: 'p1', name: 'Starter Pack', spinsGranted: 20 },
  quantity: 1,
  expiresAt: expiryFrom(new Date('2026-08-28T00:00:00.000Z')).toISOString(),
  ...overrides,
});

export class FakeTransactionRepository implements TransactionRepository {
  readonly created: CreateTransactionInput[] = [];

  constructor(
    private readonly outcome: Result<TransactionView, TransactionError> = ok(aTransaction()),
    private readonly stored: TransactionView[] = [],
  ) {}

  createPending(
    input: CreateTransactionInput,
  ): Promise<Result<TransactionView, TransactionError>> {
    this.created.push(input);
    return Promise.resolve(this.outcome);
  }

  findByReference(reference: string): Promise<TransactionView | null> {
    return Promise.resolve(this.stored.find((t) => t.reference === reference) ?? null);
  }
}

export class FailingTransactionRepository implements TransactionRepository {
  constructor(private readonly reason: unknown = new Error('connection lost')) {}

  createPending(): Promise<Result<TransactionView, TransactionError>> {
    return Promise.reject(this.reason);
  }

  findByReference(): Promise<TransactionView | null> {
    return Promise.reject(this.reason);
  }
}
