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
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateTransaction } from '../../application/create-transaction';
import { GetTransaction } from '../../application/get-transaction';
import type { TransactionError, TransactionView } from '../../domain/transaction';
import { CreateTransactionDto } from './create-transaction.dto';
import { TransactionResponse } from './transaction.response';

@ApiTags('Transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly createTransaction: CreateTransaction,
    private readonly getTransaction: GetTransaction,
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
  const body = { error };

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
