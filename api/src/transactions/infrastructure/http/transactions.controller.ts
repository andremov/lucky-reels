import {
  Body,
  ConflictException,
  Controller,
  Get,
  GoneException,
  HttpCode,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateTransaction } from '../../application/create-transaction';
import { PayTransaction } from '../../application/pay-transaction';
import { GetTransaction } from '../../application/get-transaction';
import type { TransactionError, TransactionView } from '../../domain/transaction';
import { CreateTransactionDto } from './create-transaction.dto';
import { PayTransactionDto } from './pay-transaction.dto';
import { TransactionResponse } from './transaction.response';

@ApiTags('Transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly createTransaction: CreateTransaction,
    private readonly getTransaction: GetTransaction,
    private readonly payTransaction: PayTransaction,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Start a purchase',
    description:
      'Creates a PENDING transaction and reserves the stock. Card details are not sent here. ' +
      'The returned reference is the idempotency key for the rest of the flow.',
  })
  @ApiCreatedResponse({ type: TransactionResponse })
  async create(@Body() body: CreateTransactionDto): Promise<TransactionView> {
    const result = await this.createTransaction.execute(body);

    return result.match({ ok: (transaction) => transaction, err: toHttpError });
  }

  @Post(':reference/pay')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Submit payment for a transaction',
    description:
      'Hands the card token over to the payment gateway. Accepted, not decided: poll the ' +
      'transaction for the outcome. Safe to retry with the same reference; a settled ' +
      'transaction is returned as is rather than charged again.',
  })
  @ApiAcceptedResponse({ type: TransactionResponse })
  async pay(
    @Param('reference') reference: string,
    @Body() body: PayTransactionDto,
  ): Promise<TransactionView> {
    const result = await this.payTransaction.execute({
      reference,
      paymentToken: body.paymentToken,
      installments: body.installments ?? 1,
    });

    return result.match({ ok: (transaction) => transaction, err: toHttpError });
  }

  @Get(':reference')
  @ApiOperation({
    summary: 'Read a transaction',
    description: 'Poll this after paying. creditsGranted and playerToken appear once APPROVED.',
  })
  @ApiOkResponse({ type: TransactionResponse })
  async byReference(@Param('reference') reference: string): Promise<TransactionView> {
    const result = await this.getTransaction.execute(reference);

    return result.match({ ok: (transaction) => transaction, err: toHttpError });
  }
}

export function toHttpError(error: TransactionError): never {
  // The envelope is code + message, plus details only where the contract says
  // so. Domain errors carry extra context for our own use; it does not leak out
  // and make the error shape vary per endpoint.
  const body = {
    error: {
      code: error.code,
      message: error.message,
      ...('details' in error ? { details: error.details } : {}),
    },
  };

  switch (error.code) {
    case 'PRODUCT_NOT_FOUND':
    case 'TRANSACTION_NOT_FOUND':
      throw new NotFoundException(body);
    case 'OUT_OF_STOCK':
    case 'TRANSACTION_ALREADY_SETTLED':
      throw new ConflictException(body);
    case 'TRANSACTION_EXPIRED':
      throw new GoneException(body);
    default:
      throw new InternalServerErrorException(body);
  }
}
