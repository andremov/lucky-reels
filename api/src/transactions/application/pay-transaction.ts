import { err, errAsync, ok, okAsync, ResultAsync } from '../../shared/result/result';
import type { PaymentGateway } from '../../payments/domain/payment-gateway';
import {
  expired,
  internalError,
  isExpired,
  isTerminal,
  transactionNotFound,
  type TransactionError,
  type TransactionView,
} from '../domain/transaction';
import type { TransactionRepository } from './transaction-repository';

export type PayInput = {
  reference: string;
  paymentToken: string;
  installments: number;
};

export class PayTransaction {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly gateway: PaymentGateway,
    private readonly now: () => Date = () => new Date(),
  ) {}

  execute(input: PayInput): ResultAsync<TransactionView, TransactionError> {
    return ResultAsync.fromPromise(
      this.transactions.findByReference(input.reference),
      internalError,
    )
      .andThen((found) => (found ? ok(found) : err(transactionNotFound(input.reference))))
      .andThen((transaction) => this.settleOrSkip(transaction, input));
  }

  /**
   * A settled transaction is returned as it stands and the gateway is never
   * called: paying twice is a double submit, not a failure, and the customer
   * should see the result they already have.
   */
  private settleOrSkip(transaction: TransactionView, input: PayInput) {
    if (isTerminal(transaction.status)) return okAsync<TransactionView, TransactionError>(transaction);
    if (isExpired(new Date(transaction.expiresAt), this.now())) {
      return errAsync<TransactionError, TransactionView>(expired());
    }

    return this.charge(transaction, input);
  }

  private charge(transaction: TransactionView, input: PayInput) {
    return ResultAsync.fromPromise(
      this.transactions
        .customerEmailFor(transaction.reference)
        .then((email) =>
          this.gateway.charge({
            reference: transaction.reference,
            amountCents: transaction.amounts.totalCents,
            currency: 'COP',
            paymentToken: input.paymentToken,
            installments: input.installments,
            customerEmail: email ?? 'unknown@lucky-reels.invalid',
          }),
        ),
      internalError,
    ).andThen((outcome) =>
      ResultAsync.fromPromise(
        this.transactions.settle(transaction.reference, outcome),
        internalError,
      ).andThen((settled) => settled),
    );
  }
}
