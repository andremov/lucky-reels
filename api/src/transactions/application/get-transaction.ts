import { err, ok, ResultAsync } from '../../shared/result/result';
import {
  internalError,
  transactionNotFound,
  type TransactionError,
  type TransactionView,
} from '../domain/transaction';
import type { TransactionRepository } from './transaction-repository';

export class GetTransaction {
  constructor(private readonly transactions: TransactionRepository) {}

  execute(reference: string): ResultAsync<TransactionView, TransactionError> {
    return ResultAsync.fromPromise(
      this.transactions.findByReference(reference),
      internalError,
    ).andThen((found) => (found ? ok(found) : err(transactionNotFound(reference))));
  }
}
