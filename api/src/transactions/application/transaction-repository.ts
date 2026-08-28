import type { Result } from '../../shared/result/result';
import type { ChargeOutcome } from '../../payments/domain/payment-gateway';
import type { TransactionError, TransactionView } from '../domain/transaction';

export type CustomerInput = {
  email: string;
  fullName: string;
  phone: string;
};

export type DeliveryInput = {
  addressLine: string;
  city: string;
  region: string;
  postalCode: string;
};

export type CreateTransactionInput = {
  productId: string;
  quantity: number;
  customer: CustomerInput;
  delivery: DeliveryInput;
};

export interface TransactionRepository {
  /**
   * Reserves stock and writes the pending transaction as one unit of work.
   * The reservation and the insert have to commit or fail together, so this is
   * a single call rather than steps the use case could interleave.
   */
  createPending(input: CreateTransactionInput): Promise<Result<TransactionView, TransactionError>>;

  findByReference(reference: string): Promise<TransactionView | null>;

  /**
   * Applies a gateway outcome under a row lock. Committing the reservation,
   * granting credits and marking the transaction settled are one unit of work,
   * and a transaction that is already settled is returned untouched so a
   * retried payment cannot pay twice.
   */
  settle(
    reference: string,
    outcome: ChargeOutcome,
  ): Promise<Result<TransactionView, TransactionError>>;
}

export const TRANSACTION_REPOSITORY = Symbol('TransactionRepository');
