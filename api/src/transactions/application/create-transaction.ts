import { ResultAsync } from '../../shared/result/result';
import { internalError, type TransactionError, type TransactionView } from '../domain/transaction';
import type { CreateTransactionInput, TransactionRepository } from './transaction-repository';

export class CreateTransaction {
  constructor(private readonly transactions: TransactionRepository) {}

  execute(input: CreateTransactionInput): ResultAsync<TransactionView, TransactionError> {
    return ResultAsync.fromPromise(
      this.transactions.createPending(input),
      internalError,
    ).andThen((result) => result);
  }
}
