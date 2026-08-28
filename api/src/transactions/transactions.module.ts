import { Module } from '@nestjs/common';
import { CreateTransaction } from './application/create-transaction';
import { GetTransaction } from './application/get-transaction';
import { PayTransaction } from './application/pay-transaction';
import { Logger } from '@nestjs/common';
import { StubGateway } from '../payments/infrastructure/stub-gateway';
import { LiveGateway } from '../payments/infrastructure/live-gateway';
import { selectGateway } from '../payments/infrastructure/select-gateway';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../payments/domain/payment-gateway';
import type { TransactionRepository } from './application/transaction-repository';
import { TransactionsController } from './infrastructure/http/transactions.controller';
import { TypeormTransactionRepository } from './infrastructure/persistence/typeorm-transaction.repository';

@Module({
  controllers: [TransactionsController],
  providers: [
    TypeormTransactionRepository,
    StubGateway,
    {
      // The live adapter binds only when every key is present. Absent or
      // partial configuration keeps the stub, so an unconfigured deployment
      // behaves exactly as it did before this existed.
      provide: PAYMENT_GATEWAY,
      inject: [StubGateway],
      useFactory: (stub: StubGateway): PaymentGateway => {
        const selection = selectGateway(process.env);
        const logger = new Logger('PaymentGateway');

        if (selection.kind === 'live') {
          logger.log('Live payment gateway configured');
          return new LiveGateway(selection.config);
        }

        logger.warn(
          selection.reason === 'partially configured'
            ? `Using the stub gateway: ${selection.missing.join(', ')} not set`
            : 'Using the stub gateway: no provider keys configured',
        );
        return stub;
      },
    },
    {
      provide: CreateTransaction,
      inject: [TypeormTransactionRepository],
      useFactory: (repository: TransactionRepository) => new CreateTransaction(repository),
    },
    {
      provide: PayTransaction,
      inject: [TypeormTransactionRepository, PAYMENT_GATEWAY],
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
