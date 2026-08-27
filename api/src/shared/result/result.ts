export type Result<T, E> = Ok<T, E> | Err<T, E>;

export class Ok<T, E> {
  readonly ok = true as const;

  constructor(readonly value: T) {}

  isOk(): this is Ok<T, E> {
    return true;
  }

  isErr(): this is Err<T, E> {
    return false;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    return new Ok(fn(this.value));
  }

  mapErr<F>(_fn: (error: E) => F): Result<T, F> {
    return new Ok(this.value);
  }

  andThen<U, F>(fn: (value: T) => Result<U, F>): Result<U, E | F> {
    return fn(this.value);
  }

  asyncAndThen<U, F>(fn: (value: T) => PromiseLike<Result<U, F>>): ResultAsync<U, E | F> {
    return new ResultAsync<U, E | F>(Promise.resolve(fn(this.value)));
  }

  unwrapOr(_fallback: T): T {
    return this.value;
  }

  match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U {
    return handlers.ok(this.value);
  }
}

export class Err<T, E> {
  readonly ok = false as const;

  constructor(readonly error: E) {}

  isOk(): this is Ok<T, E> {
    return false;
  }

  isErr(): this is Err<T, E> {
    return true;
  }

  map<U>(_fn: (value: T) => U): Result<U, E> {
    return new Err(this.error);
  }

  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return new Err(fn(this.error));
  }

  andThen<U, F>(_fn: (value: T) => Result<U, F>): Result<U, E | F> {
    return new Err(this.error);
  }

  asyncAndThen<U, F>(_fn: (value: T) => PromiseLike<Result<U, F>>): ResultAsync<U, E | F> {
    return new ResultAsync<U, E | F>(Promise.resolve(new Err(this.error)));
  }

  unwrapOr(fallback: T): T {
    return fallback;
  }

  match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U {
    return handlers.err(this.error);
  }
}

export const ok = <T, E = never>(value: T): Result<T, E> => new Ok(value);
export const err = <E, T = never>(error: E): Result<T, E> => new Err(error);

export class ResultAsync<T, E> implements PromiseLike<Result<T, E>> {
  constructor(private readonly inner: Promise<Result<T, E>>) {}

  static fromSafePromise<T, E = never>(promise: PromiseLike<T>): ResultAsync<T, E> {
    return new ResultAsync<T, E>(Promise.resolve(promise).then((value) => new Ok(value)));
  }

  static fromPromise<T, E>(
    promise: PromiseLike<T>,
    onRejected: (reason: unknown) => E,
  ): ResultAsync<T, E> {
    return new ResultAsync<T, E>(
      Promise.resolve(promise).then(
        (value): Result<T, E> => new Ok(value),
        (reason): Result<T, E> => new Err(onRejected(reason)),
      ),
    );
  }

  map<U>(fn: (value: T) => U | Promise<U>): ResultAsync<U, E> {
    return new ResultAsync<U, E>(
      this.inner.then(async (result) =>
        result.isOk() ? new Ok<U, E>(await fn(result.value)) : new Err<U, E>(result.error),
      ),
    );
  }

  mapErr<F>(fn: (error: E) => F | Promise<F>): ResultAsync<T, F> {
    return new ResultAsync<T, F>(
      this.inner.then(async (result) =>
        result.isErr() ? new Err<T, F>(await fn(result.error)) : new Ok<T, F>(result.value),
      ),
    );
  }

  andThen<U, F>(
    fn: (value: T) => Result<U, F> | PromiseLike<Result<U, F>>,
  ): ResultAsync<U, E | F> {
    return new ResultAsync<U, E | F>(
      this.inner.then(async (result) =>
        result.isOk() ? await fn(result.value) : new Err<U, E | F>(result.error),
      ),
    );
  }

  match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): Promise<U> {
    return this.inner.then((result) => result.match(handlers));
  }

  then<A, B = never>(
    onFulfilled?: ((value: Result<T, E>) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.inner.then(onFulfilled, onRejected);
  }
}

export const okAsync = <T, E = never>(value: T): ResultAsync<T, E> =>
  new ResultAsync<T, E>(Promise.resolve(new Ok(value)));

export const errAsync = <E, T = never>(error: E): ResultAsync<T, E> =>
  new ResultAsync<T, E>(Promise.resolve(new Err(error)));
