import {
  BASE_FEE_CENTS,
  computeAmounts,
  DELIVERY_FEE_CENTS,
  expiryFrom,
  generateReference,
  isExpired,
  isTerminal,
  RESERVATION_MINUTES,
  outOfStock,
  productNotFound,
  transactionNotFound,
  alreadySettled,
  expired,
  internalError,
} from './transaction';

describe('computeAmounts', () => {
  it('adds the base fee and delivery fee to the product total', () => {
    const amounts = computeAmounts(2_000_000, 1);

    expect(amounts).toEqual({
      productCents: 2_000_000,
      baseFeeCents: BASE_FEE_CENTS,
      deliveryFeeCents: DELIVERY_FEE_CENTS,
      totalCents: 2_000_000 + BASE_FEE_CENTS + DELIVERY_FEE_CENTS,
      currency: 'COP',
    });
  });

  it('multiplies the product line by quantity but charges the fees once', () => {
    const amounts = computeAmounts(1_000_000, 3);

    expect(amounts.productCents).toBe(3_000_000);
    expect(amounts.baseFeeCents).toBe(BASE_FEE_CENTS);
    expect(amounts.deliveryFeeCents).toBe(DELIVERY_FEE_CENTS);
  });

  it('always totals its own parts', () => {
    for (const [price, quantity] of [
      [1, 1],
      [999_999, 7],
      [15_000_000, 2],
    ] as const) {
      const a = computeAmounts(price, quantity);
      expect(a.totalCents).toBe(a.productCents + a.baseFeeCents + a.deliveryFeeCents);
    }
  });

  it('stays an integer, so no fractional cents can appear', () => {
    const amounts = computeAmounts(333_333, 3);

    expect(Number.isInteger(amounts.totalCents)).toBe(true);
  });
});

describe('generateReference', () => {
  it('is prefixed so it is recognisable in a log', () => {
    expect(generateReference()).toMatch(/^LR-[0-9A-F]{8}$/);
  });

  it('does not repeat across many draws', () => {
    const drawn = new Set(Array.from({ length: 500 }, generateReference));

    expect(drawn.size).toBe(500);
  });
});

describe('expiry', () => {
  const now = new Date('2026-08-28T00:00:00.000Z');

  it('holds the reservation for the configured window', () => {
    expect(expiryFrom(now).getTime() - now.getTime()).toBe(RESERVATION_MINUTES * 60_000);
  });

  it('is not expired while the window is open', () => {
    expect(isExpired(expiryFrom(now), now)).toBe(false);
  });

  it('is expired once the window closes exactly', () => {
    expect(isExpired(now, now)).toBe(true);
  });

  it('is expired afterwards', () => {
    const later = new Date(now.getTime() + 1);

    expect(isExpired(now, later)).toBe(true);
  });
});

describe('isTerminal', () => {
  it('treats pending as still open', () => {
    expect(isTerminal('PENDING')).toBe(false);
  });

  it.each(['APPROVED', 'DECLINED', 'ERROR'] as const)('treats %s as settled', (status) => {
    expect(isTerminal(status)).toBe(true);
  });
});

describe('error builders', () => {
  it('says sold out when nothing is left', () => {
    expect(outOfStock(0).message).toBe('Sold out');
  });

  it('says how many remain otherwise', () => {
    expect(outOfStock(3).message).toBe('Only 3 left');
  });

  it('names the product it could not find', () => {
    expect(productNotFound('ghost').message).toContain('ghost');
  });

  it('names the reference it could not find', () => {
    expect(transactionNotFound('LR-X').message).toContain('LR-X');
  });

  it('reports the status a settled transaction already has', () => {
    const error = alreadySettled('APPROVED');

    expect(error).toEqual({
      code: 'TRANSACTION_ALREADY_SETTLED',
      message: 'Transaction is already APPROVED',
      status: 'APPROVED',
    });
  });

  it('tells the customer what to do when the reservation lapsed', () => {
    expect(expired().message).toMatch(/again/i);
  });

  it('carries the reason from a real Error', () => {
    expect(internalError(new Error('pool exhausted')).message).toBe('pool exhausted');
  });

  it('copes with something thrown that is not an Error', () => {
    expect(internalError('socket hang up').message).toBe('Unexpected failure');
  });
});
