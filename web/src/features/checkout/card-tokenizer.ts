import { buildPaymentToken } from './payment-token';
import type { CardDraft, Errors } from './validation';

/**
 * Tokenisation happens in the browser so the card number never reaches our API.
 * That is a security property, not a convenience: doing it server-side would
 * work, and would make the README's claim about the number false.
 */
export type CardTokenizer = {
  readonly mode: 'stub' | 'live';
  tokenize(card: CardDraft): Promise<string>;
};

/** Field-level failures from the provider, keyed the way the card form is. */
export class TokenizationError extends Error {
  readonly fieldErrors: Errors;

  constructor(message: string, fieldErrors: Errors = {}) {
    super(message);
    this.name = 'TokenizationError';
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Tokens the stub gateway recognises. Anchored, never substring-matched: a real
 * provider id looks like `tok_stagtest_5113_B2Ff…`, and every provider token
 * contains "ok" because `tok_` does. Matching loosely would approve real tokens.
 */
const STUB_TOKEN_PATTERNS = [
  /^tok_stagtest_ok_/,
  /^tok_stagtest_decline_/,
  /^tok_stagtest_error_/,
  /^tok_ok$/,
  /^tok_approve$/,
  /^tok_decline$/,
  /^tok_error$/,
];

export const isStubToken = (token: string) => STUB_TOKEN_PATTERNS.some((p) => p.test(token));

/**
 * A token of the wrong kind must never reach the wire. If the two halves are
 * configured differently, that is a misconfiguration and it should be loud
 * here rather than settling as a payment on the other side.
 */
export function assertTokenMatchesMode(token: string, mode: 'stub' | 'live'): void {
  const looksStub = isStubToken(token);
  if (mode === 'stub' && !looksStub) {
    throw new TokenizationError(
      'Configuration mismatch: a live gateway token was produced while the stub is configured.',
    );
  }
  if (mode === 'live' && looksStub) {
    throw new TokenizationError(
      'Configuration mismatch: a stub token was produced while the live gateway is configured.',
    );
  }
}

export function createStubTokenizer(): CardTokenizer {
  return {
    mode: 'stub',
    async tokenize(card) {
      const token = buildPaymentToken(card.cardNumber);
      assertTokenMatchesMode(token, 'stub');
      return token;
    },
  };
}

/** Maps the provider's field names onto the card form's. */
const FIELD_MAP: Record<string, keyof CardDraft | 'cvv'> = {
  number: 'cardNumber',
  cvc: 'cvv',
  exp_month: 'expiry',
  exp_year: 'expiry',
  card_holder: 'cardHolder',
};

function toFieldErrors(messages: unknown): Errors {
  const errors: Errors = {};
  if (!messages || typeof messages !== 'object') return errors;

  for (const [providerField, value] of Object.entries(messages as Record<string, unknown>)) {
    const field = FIELD_MAP[providerField];
    if (!field) continue;
    const text = Array.isArray(value) ? value.join(' ') : String(value);
    // Two provider fields map onto one input; keep the first rather than
    // overwriting, so the customer sees one message per field.
    errors[field] = errors[field] ? `${errors[field]} ${text}` : text;
  }
  return errors;
}

/** MM/YY as the form collects it; the provider wants the parts separately. */
export function splitExpiry(expiry: string): { exp_month: string; exp_year: string } {
  const [month = '', year = ''] = expiry.split('/').map((part) => part.trim());
  return { exp_month: month, exp_year: year };
}

export function createLiveTokenizer(baseUrl: string, publicKey: string): CardTokenizer {
  return {
    mode: 'live',
    async tokenize(card) {
      const { exp_month, exp_year } = splitExpiry(card.expiry);

      let response: Response;
      try {
        response = await fetch(`${baseUrl}/tokens/cards`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicKey}`,
          },
          body: JSON.stringify({
            number: card.cardNumber.replace(/\D/g, ''),
            cvc: card.cvv,
            exp_month,
            exp_year,
            card_holder: card.cardHolder,
          }),
        });
      } catch {
        throw new TokenizationError('Could not reach the payment provider. Check your connection.');
      }

      let body: any = null;
      try {
        body = await response.json();
      } catch {
        // Non-JSON body; fall through to the generic message below.
      }

      if (!response.ok) {
        const fieldErrors = toFieldErrors(body?.error?.messages);
        throw new TokenizationError(
          body?.error?.reason ?? 'The payment provider rejected these card details.',
          fieldErrors,
        );
      }

      const token = body?.data?.id;
      if (typeof token !== 'string' || token.length === 0) {
        throw new TokenizationError('The payment provider did not return a card token.');
      }

      assertTokenMatchesMode(token, 'live');
      return token;
    },
  };
}
