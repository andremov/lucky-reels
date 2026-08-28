import { Module } from '@nestjs/common';
import { CreateTransaction } from './application/create-transaction';
import { GetTransaction } from './application/get-transaction';
import type { TransactionRepository } from './application/transaction-repository';
import { TransactionsController } from './infrastructure/http/transactions.controller';
import { TypeormTransactionRepository } from './infrastructure/persistence/typeorm-transaction.repository';

@Module({
  controllers: [TransactionsController],
  providers: [
    TypeormTransactionRepository,
    {
      provide: CreateTransaction,
      inject: [TypeormTransactionRepository],
      useFactory: (repository: TransactionRepository) => new CreateTransaction(repository),
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
