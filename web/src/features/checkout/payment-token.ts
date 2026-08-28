import { detectBrand } from './validation';

/**
 * Test cards that steer the stub gateway. The real gateway decides on its own,
 * but while it is stubbed the outcome has to be reachable from the card form —
 * otherwise the declined and errored result screens can never be seen.
 */
export const TEST_CARDS = {
  approve: '4242424242424242',
  decline: '4000000000000002',
  error: '4000000000000119',
} as const;

export type Outcome = 'ok' | 'decline' | 'error';

export function outcomeFor(cardNumber: string): Outcome {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits === TEST_CARDS.decline) return 'decline';
  if (digits === TEST_CARDS.error) return 'error';
  return 'ok';
}

/**
 * Stands in for the gateway's browser-side tokenisation. The card number never
 * leaves the browser — only this token is sent, and only the last four digits
 * appear in it.
 */
export function buildPaymentToken(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, '');
  return `tok_stagtest_${outcomeFor(digits)}_${detectBrand(digits)}_${digits.slice(-4)}`;
}
