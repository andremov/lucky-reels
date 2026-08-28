import {
  assertTokenMatchesMode,
  createLiveTokenizer,
  createStubTokenizer,
  isStubToken,
  splitExpiry,
  TokenizationError,
} from './card-tokenizer';
import { TEST_CARDS } from './payment-token';

/** A real id captured from the provider's sandbox. */
const REAL_TOKEN = 'tok_stagtest_5113_B2Ff12B86b499b9361e2C14f0aD2b2a2';

const CARD = {
  cardNumber: '4242424242424242',
  cardHolder: 'Someone Real',
  expiry: '12/30',
  cvv: '123',
};

function mockFetch(status: number, body: unknown) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

afterEach(() => jest.restoreAllMocks());

describe('isStubToken', () => {
  it('recognises the tokens the stub gateway answers to', () => {
    expect(isStubToken('tok_stagtest_ok_visa_4242')).toBe(true);
    expect(isStubToken('tok_stagtest_decline_visa_0002')).toBe(true);
    expect(isStubToken('tok_stagtest_error_visa_0119')).toBe(true);
    expect(isStubToken('tok_ok')).toBe(true);
    expect(isStubToken('tok_decline')).toBe(true);
  });

  // The whole reason the match is anchored. Every provider token contains "ok",
  // because "tok_" does — substring matching would treat them all as stubs.
  it('does not mistake a real provider token for a stub one', () => {
    expect(REAL_TOKEN).toContain('ok');
    expect(isStubToken(REAL_TOKEN)).toBe(false);
  });

  it('is anchored, so an outcome word appearing later does not count', () => {
    expect(isStubToken('tok_stagtest_5113_declineXYZ')).toBe(false);
    expect(isStubToken('tok_ok_extra')).toBe(false);
    expect(isStubToken('ok')).toBe(false);
    expect(isStubToken('')).toBe(false);
  });
});

describe('mismatch guard', () => {
  it('refuses a real token while the stub is configured', () => {
    expect(() => assertTokenMatchesMode(REAL_TOKEN, 'stub')).toThrow(TokenizationError);
  });

  it('refuses a stub token while the live gateway is configured', () => {
    expect(() => assertTokenMatchesMode('tok_stagtest_ok_visa_4242', 'live')).toThrow(
      TokenizationError,
    );
  });

  it('accepts each token in its own mode', () => {
    expect(() => assertTokenMatchesMode('tok_stagtest_ok_visa_4242', 'stub')).not.toThrow();
    expect(() => assertTokenMatchesMode(REAL_TOKEN, 'live')).not.toThrow();
  });
});

describe('stub tokenizer', () => {
  it('still produces the documented tokens for the documented cards', async () => {
    const t = createStubTokenizer();
    expect(await t.tokenize({ ...CARD, cardNumber: TEST_CARDS.approve })).toBe(
      'tok_stagtest_ok_visa_4242',
    );
    expect(await t.tokenize({ ...CARD, cardNumber: TEST_CARDS.decline })).toBe(
      'tok_stagtest_decline_visa_0002',
    );
    expect(await t.tokenize({ ...CARD, cardNumber: TEST_CARDS.error })).toBe(
      'tok_stagtest_error_visa_0119',
    );
  });

  it('reports its mode', () => {
    expect(createStubTokenizer().mode).toBe('stub');
  });
});

describe('splitExpiry', () => {
  it('splits MM/YY into the parts the provider wants', () => {
    expect(splitExpiry('12/30')).toEqual({ exp_month: '12', exp_year: '30' });
    expect(splitExpiry(' 01 / 26 ')).toEqual({ exp_month: '01', exp_year: '26' });
  });
});

describe('live tokenizer', () => {
  const BASE = 'https://gateway.test/v1';
  const KEY = 'pub_test_key';

  it('posts the card to the provider and returns their token id', async () => {
    const fetchMock = mockFetch(201, { data: { id: REAL_TOKEN } });
    const token = await createLiveTokenizer(BASE, KEY).tokenize(CARD);

    expect(token).toBe(REAL_TOKEN);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/tokens/cards`);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(init.body)).toEqual({
      number: '4242424242424242',
      cvc: '123',
      exp_month: '12',
      exp_year: '30',
      card_holder: 'Someone Real',
    });
  });

  it('lands a rejected card number on the card-number field', async () => {
    mockFetch(422, {
      error: {
        type: 'INPUT_VALIDATION_ERROR',
        messages: {
          number: ['El número de tarjeta usado no es aceptado en el ambiente de pruebas.'],
        },
      },
    });

    const error = await createLiveTokenizer(BASE, KEY)
      .tokenize({ ...CARD, cardNumber: '4000000000000002' })
      .catch((e) => e);

    expect(error).toBeInstanceOf(TokenizationError);
    expect(error.fieldErrors.cardNumber).toMatch(/no es aceptado/);
  });

  it('maps the provider field names onto the form field names', async () => {
    mockFetch(422, {
      error: { messages: { cvc: ['invalid'], card_holder: ['required'], exp_month: ['bad'] } },
    });

    const error = await createLiveTokenizer(BASE, KEY).tokenize(CARD).catch((e) => e);

    expect(error.fieldErrors.cvv).toBe('invalid');
    expect(error.fieldErrors.cardHolder).toBe('required');
    expect(error.fieldErrors.expiry).toBe('bad');
  });

  it('reports a network failure as something the customer can act on', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch')) as never;

    const error = await createLiveTokenizer(BASE, KEY).tokenize(CARD).catch((e) => e);

    expect(error).toBeInstanceOf(TokenizationError);
    expect(error.message).toMatch(/could not reach/i);
    expect(error.fieldErrors).toEqual({});
  });

  it('refuses a success response with no token rather than sending nothing', async () => {
    mockFetch(201, { data: {} });

    const error = await createLiveTokenizer(BASE, KEY).tokenize(CARD).catch((e) => e);
    expect(error).toBeInstanceOf(TokenizationError);
    expect(error.message).toMatch(/did not return a card token/i);
  });

  it('refuses to pass on a stub-shaped token, so a misconfiguration is loud', async () => {
    mockFetch(201, { data: { id: 'tok_stagtest_ok_visa_4242' } });

    const error = await createLiveTokenizer(BASE, KEY).tokenize(CARD).catch((e) => e);
    expect(error).toBeInstanceOf(TokenizationError);
    expect(error.message).toMatch(/mismatch/i);
  });

  it('never puts the full card number anywhere but the provider request', async () => {
    const fetchMock = mockFetch(201, { data: { id: REAL_TOKEN } });
    const token = await createLiveTokenizer(BASE, KEY).tokenize(CARD);

    expect(token).not.toContain('4242424242424242');
    expect(fetchMock.mock.calls[0][0]).not.toContain('4242');
  });
});
