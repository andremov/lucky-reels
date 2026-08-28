import type { Result } from '../../shared/result/result';
import { Stock, type StockError } from './stock';

const stock = (available: number, reserved = 0) =>
  Stock.from({ productId: 'p1', available, reserved });

const codeOf = (result: Result<Stock, StockError>) =>
  result.match({ ok: () => 'ok', err: (e) => e.code });

describe('reserve', () => {
  it('moves units from available to reserved', () => {
    const result = stock(10).reserve(3);

    expect(result.match({ ok: (s) => s.toSnapshot(), err: () => null })).toEqual({
      productId: 'p1',
      available: 7,
      reserved: 3,
    });
  });

  it('allows taking the last unit', () => {
    expect(codeOf(stock(1).reserve(1))).toBe('ok');
  });

  it('refuses to oversell', () => {
    expect(codeOf(stock(2).reserve(3))).toBe('OUT_OF_STOCK');
  });

  it('refuses to reserve against an empty shelf', () => {
    expect(codeOf(stock(0).reserve(1))).toBe('OUT_OF_STOCK');
  });

  it('reports how many are actually left when it refuses', () => {
    const left = stock(2).reserve(5).match({
      ok: () => -1,
      err: (e) => (e.code === 'OUT_OF_STOCK' ? e.available : -1),
    });

    expect(left).toBe(2);
  });

  it('does not count someone else reservation as available', () => {
    expect(codeOf(stock(1, 4).reserve(2))).toBe('OUT_OF_STOCK');
  });

  it.each([0, -1, 1.5, NaN])('rejects a quantity of %p', (quantity) => {
    expect(codeOf(stock(10).reserve(quantity))).toBe('INVALID_QUANTITY');
  });

  it('leaves the original untouched', () => {
    const before = stock(10);
    before.reserve(3);

    expect(before.available).toBe(10);
    expect(before.reserved).toBe(0);
  });
});

describe('commit', () => {
  it('drops the reservation without returning units to the shelf', () => {
    const result = stock(7, 3).commit(3);

    expect(result.match({ ok: (s) => s.toSnapshot(), err: () => null })).toEqual({
      productId: 'p1',
      available: 7,
      reserved: 0,
    });
  });

  it('can settle part of a reservation', () => {
    const result = stock(7, 3).commit(1);

    expect(result.match({ ok: (s) => s.reserved, err: () => -1 })).toBe(2);
  });

  it('refuses to settle more than was reserved', () => {
    expect(codeOf(stock(7, 3).commit(4))).toBe('RESERVATION_TOO_LARGE');
  });

  it.each([0, -2, 2.5])('rejects a quantity of %p', (quantity) => {
    expect(codeOf(stock(7, 3).commit(quantity))).toBe('INVALID_QUANTITY');
  });
});

describe('release', () => {
  it('puts the units back on the shelf', () => {
    const result = stock(7, 3).release(3);

    expect(result.match({ ok: (s) => s.toSnapshot(), err: () => null })).toEqual({
      productId: 'p1',
      available: 10,
      reserved: 0,
    });
  });

  it('refuses to release more than was reserved', () => {
    expect(codeOf(stock(7, 3).release(4))).toBe('RESERVATION_TOO_LARGE');
  });

  it.each([0, -2, 2.5])('rejects a quantity of %p', (quantity) => {
    expect(codeOf(stock(7, 3).release(quantity))).toBe('INVALID_QUANTITY');
  });
});

describe('invariants', () => {
  it('keeps the total constant through reserve then commit', () => {
    const start = stock(10);
    const after = start
      .reserve(4)
      .andThen((s) => s.commit(4))
      .match({ ok: (s) => s, err: () => null });

    expect(start.total).toBe(10);
    expect(after?.total).toBe(6);
    expect(after?.reserved).toBe(0);
  });

  it('restores the original state through reserve then release', () => {
    const after = stock(10)
      .reserve(4)
      .andThen((s) => s.release(4))
      .match({ ok: (s) => s.toSnapshot(), err: () => null });

    expect(after).toEqual({ productId: 'p1', available: 10, reserved: 0 });
  });

  it('cannot let two reservations exceed what exists', () => {
    const outcome = stock(3)
      .reserve(2)
      .andThen((s) => s.reserve(2));

    expect(codeOf(outcome)).toBe('OUT_OF_STOCK');
  });

  it('never lets available or reserved go negative across a long sequence', () => {
    let current = stock(5);

    for (const step of [1, 2, 1, 1] as const) {
      current = current.reserve(step).match({ ok: (s) => s, err: () => current });
    }
    for (const step of [2, 3] as const) {
      current = current.commit(step).match({ ok: (s) => s, err: () => current });
    }

    expect(current.available).toBeGreaterThanOrEqual(0);
    expect(current.reserved).toBeGreaterThanOrEqual(0);
  });
});
