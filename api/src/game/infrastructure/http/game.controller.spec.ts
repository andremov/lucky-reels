import { HttpException, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import type { GameError } from '../../domain/spin';
import { toHttpError } from './game.controller';

const thrownBy = (error: GameError) => {
  try {
    toHttpError(error);
  } catch (thrown) {
    return thrown as HttpException;
  }
  throw new Error('toHttpError did not throw');
};

describe('toHttpError', () => {
  it('maps a bad or missing token to 401', () => {
    expect(thrownBy({ code: 'UNAUTHORIZED', message: 'x' })).toBeInstanceOf(UnauthorizedException);
  });

  it('maps an empty balance to 402, not 400', () => {
    const thrown = thrownBy({ code: 'INSUFFICIENT_CREDITS', message: 'x' });

    expect(thrown.getStatus()).toBe(402);
  });

  it('maps anything else to 500', () => {
    expect(thrownBy({ code: 'INTERNAL_ERROR', message: 'x' })).toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('wraps the domain error in the standard envelope', () => {
    const thrown = thrownBy({ code: 'INSUFFICIENT_CREDITS', message: 'A spin costs 1 credit' });

    expect(thrown.getResponse()).toEqual({
      error: { code: 'INSUFFICIENT_CREDITS', message: 'A spin costs 1 credit' },
    });
  });

  it('keeps the envelope to code and message on every branch', () => {
    for (const error of [
      { code: 'UNAUTHORIZED', message: 'a' },
      { code: 'INSUFFICIENT_CREDITS', message: 'b' },
      { code: 'INTERNAL_ERROR', message: 'c' },
    ] as GameError[]) {
      const body = thrownBy(error).getResponse() as { error: Record<string, unknown> };

      expect(Object.keys(body.error).sort()).toEqual(['code', 'message']);
    }
  });

  it('does not leak the token in any error message', () => {
    const thrown = thrownBy({ code: 'UNAUTHORIZED', message: 'Missing or unknown player token' });
    const body = thrownBy({ code: 'UNAUTHORIZED', message: 'x' }).getResponse();

    expect(JSON.stringify(body)).not.toMatch(/plr_/);
    expect(thrown.getStatus()).toBe(401);
  });
});
