import { payoutFor, resolveSpin, SYMBOLS } from './spin';

describe('payoutFor', () => {
  it('pays the symbol rate for three of a kind', () => {
    expect(payoutFor(['diamond', 'diamond', 'diamond'])).toBe(100);
    expect(payoutFor(['cherry', 'cherry', 'cherry'])).toBe(10);
  });

  it('pays a flat rate for a pair, wherever it sits', () => {
    expect(payoutFor(['bell', 'bell', 'star'])).toBe(2);
    expect(payoutFor(['star', 'bell', 'bell'])).toBe(2);
    expect(payoutFor(['bell', 'star', 'bell'])).toBe(2);
  });

  it('pays nothing when all three differ', () => {
    expect(payoutFor(['cherry', 'lemon', 'bell'])).toBe(0);
  });
});

describe('resolveSpin', () => {
  it('uses the injected rng to pick each reel', () => {
    // 0 maps to the first symbol, so a constant 0 gives three of a kind.
    const spin = resolveSpin(() => 0);

    expect(spin.reels).toEqual([SYMBOLS[0], SYMBOLS[0], SYMBOLS[0]]);
    expect(spin.payout).toBe(10);
  });

  it('draws a different symbol per reel', () => {
    const values = [0, 0.25, 0.5];
    let i = 0;
    const spin = resolveSpin(() => values[i++]);

    expect(spin.reels).toEqual([SYMBOLS[0], SYMBOLS[1], SYMBOLS[2]]);
    expect(spin.payout).toBe(0);
  });

  it('never picks past the end of the symbol list', () => {
    const spin = resolveSpin(() => 0.999999);

    expect(spin.reels.every((s) => SYMBOLS.includes(s))).toBe(true);
  });
});
