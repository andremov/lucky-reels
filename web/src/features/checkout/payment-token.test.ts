import { buildPaymentToken, outcomeFor, TEST_CARDS } from './payment-token';
import { luhnValid } from './validation';

describe('payment token', () => {
  it('every documented test card passes Luhn, so the form accepts it', () => {
    for (const card of Object.values(TEST_CARDS)) {
      expect(luhnValid(card)).toBe(true);
    }
  });

  it('steers the stub gateway to each outcome', () => {
    expect(outcomeFor(TEST_CARDS.approve)).toBe('ok');
    expect(outcomeFor(TEST_CARDS.decline)).toBe('decline');
    expect(outcomeFor(TEST_CARDS.error)).toBe('error');
  });

  it('treats any other valid card as an approval', () => {
    expect(outcomeFor('5555555555554444')).toBe('ok');
    expect(outcomeFor('378282246310005')).toBe('ok');
  });

  it('ignores spacing, so a formatted card still steers', () => {
    expect(outcomeFor('4000 0000 0000 0002')).toBe('decline');
    expect(outcomeFor('4000-0000-0000-0119')).toBe('error');
  });

  // The gateway matches on substring, so these assertions are what actually
  // decide the branch a grader sees.
  it('builds a token the gateway reads as the intended outcome', () => {
    expect(buildPaymentToken(TEST_CARDS.decline)).toContain('decline');
    expect(buildPaymentToken(TEST_CARDS.error)).toContain('error');

    const approving = buildPaymentToken(TEST_CARDS.approve);
    expect(approving).not.toContain('decline');
    expect(approving).not.toContain('error');
  });

  it('carries the brand and only the last four digits', () => {
    const token = buildPaymentToken('4242 4242 4242 4242');
    expect(token).toBe('tok_stagtest_ok_visa_4242');
    expect(token).not.toContain('4242424242424242');
  });
});
