import {
  ConflictException,
  GoneException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { TransactionError } from '../../domain/transaction';
import { toHttpError } from './transactions.controller';

const thrownBy = (error: TransactionError) => {
  try {
    toHttpError(error);
  } catch (thrown) {
    return thrown;
  }
  throw new Error('toHttpError did not throw');
};

describe('toHttpError', () => {
  it('maps a missing product to 404', () => {
    expect(thrownBy({ code: 'PRODUCT_NOT_FOUND', message: 'x' })).toBeInstanceOf(NotFoundException);
  });

  it('maps a missing transaction to 404', () => {
    expect(thrownBy({ code: 'TRANSACTION_NOT_FOUND', message: 'x' })).toBeInstanceOf(
      NotFoundException,
    );
  });

  it('maps sold out to 409, since the request was valid and the world changed', () => {
    expect(thrownBy({ code: 'OUT_OF_STOCK', message: 'x', available: 0 })).toBeInstanceOf(
      ConflictException,
    );
  });

  it('maps an already settled transaction to 409', () => {
    expect(
      thrownBy({ code: 'TRANSACTION_ALREADY_SETTLED', message: 'x', status: 'APPROVED' }),
    ).toBeInstanceOf(ConflictException);
  });

  it('maps a lapsed reservation to 410', () => {
    expect(thrownBy({ code: 'TRANSACTION_EXPIRED', message: 'x' })).toBeInstanceOf(GoneException);
  });

  it('maps an internal failure to 500', () => {
    expect(thrownBy({ code: 'INTERNAL_ERROR', message: 'x' })).toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('wraps the domain error in the standard envelope', () => {
    const thrown = thrownBy({ code: 'OUT_OF_STOCK', message: 'Only 2 left', available: 2 });

    expect((thrown as ConflictException).getResponse()).toEqual({
      error: { code: 'OUT_OF_STOCK', message: 'Only 2 left', available: 2 },
    });
  });
});
