import { err, errAsync, ok, okAsync, ResultAsync, type Result } from './result';

type Fail = { kind: 'fail'; reason: string };

const fail = (reason: string): Fail => ({ kind: 'fail', reason });

describe('Result', () => {
  describe('ok', () => {
    it('reports which track it is on', () => {
      const result = ok<number, Fail>(1);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);
    });

    it('maps the value', () => {
      const result = ok<number, Fail>(2).map((n) => n * 3);

      expect(result).toEqual(ok(6));
    });

    it('leaves mapErr alone', () => {
      const fn = jest.fn();
      const result = ok<number, Fail>(2).mapErr(fn);

      expect(fn).not.toHaveBeenCalled();
      expect(result).toEqual(ok(2));
    });

    it('continues the chain through andThen', () => {
      const result = ok<number, Fail>(2).andThen((n) => ok<number, Fail>(n + 1));

      expect(result).toEqual(ok(3));
    });

    it('switches to the failure track when a step fails', () => {
      const result = ok<number, Fail>(2).andThen(() => err<Fail, number>(fail('nope')));

      expect(result.isErr()).toBe(true);
    });

    it('unwraps to its own value, not the fallback', () => {
      expect(ok<number, Fail>(2).unwrapOr(99)).toBe(2);
    });

    it('matches the ok handler', () => {
      const out = ok<number, Fail>(2).match({
        ok: (n) => `got ${n}`,
        err: () => 'unreachable',
      });

      expect(out).toBe('got 2');
    });
  });

  describe('err', () => {
    it('reports which track it is on', () => {
      const result = err<Fail, number>(fail('boom'));

      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);
    });

    it('skips map', () => {
      const fn = jest.fn();
      const result = err<Fail, number>(fail('boom')).map(fn);

      expect(fn).not.toHaveBeenCalled();
      expect(result.isErr()).toBe(true);
    });

    it('maps the error', () => {
      const result = err<Fail, number>(fail('boom')).mapErr((e) => e.reason.toUpperCase());

      expect(result).toEqual(err('BOOM'));
    });

    it('skips every remaining step in the chain', () => {
      const second = jest.fn();
      const third = jest.fn();

      err<Fail, number>(fail('boom')).andThen(second).andThen(third);

      expect(second).not.toHaveBeenCalled();
      expect(third).not.toHaveBeenCalled();
    });

    it('falls back on unwrapOr', () => {
      expect(err<Fail, number>(fail('boom')).unwrapOr(99)).toBe(99);
    });

    it('matches the err handler', () => {
      const out = err<Fail, number>(fail('boom')).match({
        ok: () => 'unreachable',
        err: (e) => `failed: ${e.reason}`,
      });

      expect(out).toBe('failed: boom');
    });
  });

  describe('asyncAndThen', () => {
    it('steps from a sync Result into an async one', async () => {
      const result = await ok<number, Fail>(2).asyncAndThen((n) => okAsync<number, Fail>(n + 1));

      expect(result).toEqual(ok(3));
    });

    it('skips the async step entirely when already failed', async () => {
      const next = jest.fn((n: number) => okAsync<number, Fail>(n));

      const result = await err<Fail, number>(fail('boom')).asyncAndThen(next);

      expect(next).not.toHaveBeenCalled();
      expect(result.match({ ok: () => 'ok', err: (e) => e.reason })).toBe('boom');
    });
  });

  it('carries the first failure to the end of a long chain', () => {
    const result = ok<number, Fail>(1)
      .andThen((n) => ok<number, Fail>(n + 1))
      .andThen(() => err<Fail, number>(fail('second step')))
      .andThen(() => ok<number, Fail>(99))
      .map((n) => n * 1000);

    expect(result.match({ ok: () => 'ok', err: (e) => e.reason })).toBe('second step');
  });
});

describe('ResultAsync', () => {
  it('is awaitable and yields a Result', async () => {
    const result = await okAsync<number, Fail>(1);

    expect(result.isOk()).toBe(true);
  });

  it('maps across the await', async () => {
    const result = await okAsync<number, Fail>(2).map((n) => n * 2);

    expect(result).toEqual(ok(4));
  });

  it('awaits an async mapper', async () => {
    const result = await okAsync<number, Fail>(2).map(async (n) => n * 5);

    expect(result).toEqual(ok(10));
  });

  it('chains steps that return a plain Result', async () => {
    const result = await okAsync<number, Fail>(2).andThen((n) => ok<number, Fail>(n + 1));

    expect(result).toEqual(ok(3));
  });

  it('chains steps that return another ResultAsync', async () => {
    const result = await okAsync<number, Fail>(2).andThen((n) => okAsync<number, Fail>(n + 1));

    expect(result).toEqual(ok(3));
  });

  it('short circuits the rest of the chain once a step fails', async () => {
    const later = jest.fn((n: number) => ok<number, Fail>(n));

    const result = await okAsync<number, Fail>(1)
      .andThen(() => errAsync<Fail, number>(fail('stop here')))
      .andThen(later);

    expect(later).not.toHaveBeenCalled();
    expect(result.match({ ok: () => 'ok', err: (e) => e.reason })).toBe('stop here');
  });

  it('maps the error track', async () => {
    const result = await errAsync<Fail, number>(fail('boom')).mapErr((e) => e.reason);

    expect(result).toEqual(err('boom'));
  });

  it('does not map the value of a failed result', async () => {
    const fn = jest.fn((n: number) => n * 2);

    const result = await errAsync<Fail, number>(fail('boom')).map(fn);

    expect(fn).not.toHaveBeenCalled();
    expect(result.isErr()).toBe(true);
  });

  it('does not map the error of a successful result', async () => {
    const fn = jest.fn((e: Fail) => e.reason);

    const result = await okAsync<number, Fail>(3).mapErr(fn);

    expect(fn).not.toHaveBeenCalled();
    expect(result).toEqual(ok(3));
  });

  it('awaits an async error mapper', async () => {
    const result = await errAsync<Fail, number>(fail('boom')).mapErr(async (e) => e.reason);

    expect(result).toEqual(err('boom'));
  });

  it('matches without an explicit await of the inner Result', async () => {
    const out = await okAsync<number, Fail>(7).match({
      ok: (n) => `got ${n}`,
      err: () => 'unreachable',
    });

    expect(out).toBe('got 7');
  });

  describe('fromPromise', () => {
    it('puts a resolved value on the success track', async () => {
      const result = await ResultAsync.fromPromise(Promise.resolve(1), () => fail('unused'));

      expect(result).toEqual(ok(1));
    });

    it('turns a rejection into a domain error instead of a throw', async () => {
      const result = await ResultAsync.fromPromise(
        Promise.reject(new Error('connection lost')),
        (reason) => fail((reason as Error).message),
      );

      expect(result.match({ ok: () => 'ok', err: (e) => e.reason })).toBe('connection lost');
    });
  });

  describe('fromSafePromise', () => {
    it('lifts a promise that cannot reject', async () => {
      const result = await ResultAsync.fromSafePromise(Promise.resolve('fine'));

      expect(result).toEqual(ok('fine'));
    });
  });

  it('reads like the payment flow it exists for', async () => {
    const steps: string[] = [];

    const validate = (n: number): Result<number, Fail> => {
      steps.push('validate');
      return n > 0 ? ok(n) : err(fail('invalid'));
    };

    const reserve = (n: number): ResultAsync<number, Fail> => {
      steps.push('reserve');
      return okAsync(n);
    };

    const charge = (): ResultAsync<number, Fail> => {
      steps.push('charge');
      return errAsync(fail('declined'));
    };

    const settle = (): ResultAsync<number, Fail> => {
      steps.push('settle');
      return okAsync(0);
    };

    const outcome = await okAsync<number, Fail>(5)
      .andThen(validate)
      .andThen(reserve)
      .andThen(charge)
      .andThen(settle)
      .match({ ok: () => 'paid', err: (e) => e.reason });

    expect(outcome).toBe('declined');
    expect(steps).toEqual(['validate', 'reserve', 'charge']);
  });
});
