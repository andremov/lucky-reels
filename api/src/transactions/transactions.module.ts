import { Module } from '@nestjs/common';
import { CreateTransaction } from './application/create-transaction';
import { GetTransaction } from './application/get-transaction';
import { PayTransaction } from './application/pay-transaction';
import { StubGateway } from '../payments/infrastructure/stub-gateway';
import type { PaymentGateway } from '../payments/domain/payment-gateway';
import type { TransactionRepository } from './application/transaction-repository';
import { TransactionsController } from './infrastructure/http/transactions.controller';
import { TypeormTransactionRepository } from './infrastructure/persistence/typeorm-transaction.repository';

@Module({
  controllers: [TransactionsController],
  providers: [
    TypeormTransactionRepository,
    StubGateway,
    {
      provide: CreateTransaction,
      inject: [TypeormTransactionRepository],
      useFactory: (repository: TransactionRepository) => new CreateTransaction(repository),
    },
    {
      provide: PayTransaction,
      inject: [TypeormTransactionRepository, StubGateway],
      useFactory: (repository: TransactionRepository, gateway: PaymentGateway) =>
        new PayTransaction(repository, gateway),
    },
    {
      provide: GetTransaction,
      inject: [TypeormTransactionRepository],
      useFactory: (repository: TransactionRepository) => new GetTransaction(repository),
    },
  ],
  exports: [TypeormTransactionRepository],
})
export class TransactionsModule {}
