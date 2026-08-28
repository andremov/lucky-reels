import { insufficientCredits, payoutFor, resolveSpin, SYMBOLS, unauthorized } from './spin';

describe('payoutFor', () => {
  it('pays the symbol rate for three of a kind', () => {
    expect(payoutFor(['diamond', 'diamond', 'diamond'])).toBe(100);
    expect(payoutFor(['cherry', 'cherry', 'cherry'])).toBe(10);
  });

  it('pays a flat rate for a pair wherever it sits', () => {
    expect(payoutFor(['bell', 'bell', 'star'])).toBe(2);
    expect(payoutFor(['star', 'bell', 'bell'])).toBe(2);
    expect(payoutFor(['bell', 'star', 'bell'])).toBe(2);
  });

  it('pays nothing when all three differ', () => {
    expect(payoutFor(['cherry', 'lemon', 'bell'])).toBe(0);
  });
});

describe('resolveSpin', () => {
  it('uses the injected rng for each reel', () => {
    const spin = resolveSpin(() => 0);

    expect(spin.reels).toEqual([SYMBOLS[0], SYMBOLS[0], SYMBOLS[0]]);
    expect(spin.payout).toBe(10);
  });

  it('draws a different symbol per reel', () => {
    const values = [0, 0.25, 0.5];
    let i = 0;

    expect(resolveSpin(() => values[i++]).reels).toEqual([SYMBOLS[0], SYMBOLS[1], SYMBOLS[2]]);
  });

  it('never picks past the end of the symbol list', () => {
    expect(resolveSpin(() => 0.999999).reels.every((s) => SYMBOLS.includes(s))).toBe(true);
  });

  it('always pays what the paytable says for the reels it drew', () => {
    for (let i = 0; i < 200; i += 1) {
      const spin = resolveSpin();
      expect(spin.payout).toBe(payoutFor(spin.reels));
    }
  });
});

describe('errors', () => {
  it('does not say whether a token was absent or simply wrong', () => {
    expect(unauthorized().message).toBe('Missing or unknown player token');
  });

  it('says what a spin costs and what the player has', () => {
    expect(insufficientCredits(0).message).toContain('you have 0');
  });
});
