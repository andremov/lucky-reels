import { createHttpCheckoutClient } from './checkout-client';
import { ApiError } from './checkout-types';

const BASE = 'https://api.example.test';

function mockFetch(responses: Array<{ ok?: boolean; status?: number; body?: unknown }>) {
  const fetchMock = jest.fn();
  for (const { ok = true, status = 200, body = {} } of responses) {
    fetchMock.mockResolvedValueOnce({
      ok,
      status,
      statusText: 'Error',
      json: async () => body,
    });
  }
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const AMOUNTS = {
  productCents: 2000000,
  baseFeeCents: 150000,
  deliveryFeeCents: 80000,
  totalCents: 2230000,
  currency: 'COP',
};

const CUSTOMER = { email: 'a@b.co', fullName: 'A B', phone: '+57300' };
const DELIVERY = { addressLine: 'x', city: 'y', region: 'z', postalCode: '1' };

afterEach(() => {
  jest.restoreAllMocks();
});

describe('http checkout client', () => {
  it('GETs the product list from the configured base url', async () => {
    const fetchMock = mockFetch([{ body: [{ id: 'p1' }] }]);
    const client = createHttpCheckoutClient(BASE);

    await expect(client.listProducts()).resolves.toEqual([{ id: 'p1' }]);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/products`, expect.anything());
  });

  it('url-encodes ids and references', async () => {
    const fetchMock = mockFetch([{ body: {} }, { body: {} }]);
    const client = createHttpCheckoutClient(BASE);

    await client.getProduct('a b/c');
    await client.getTransaction('LR 1/2');

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/products/a%20b%2Fc`);
    expect(fetchMock.mock.calls[1][0]).toBe(`${BASE}/transactions/LR%201%2F2`);
  });

  it('POSTs the transaction body as JSON', async () => {
    const fetchMock = mockFetch([
      { body: { reference: 'LR-1', status: 'PENDING', amounts: AMOUNTS, expiresAt: 'soon' } },
    ]);
    const client = createHttpCheckoutClient(BASE);

    const created = await client.createTransaction({
      productId: 'p1',
      quantity: 2,
      customer: CUSTOMER,
      delivery: DELIVERY,
    });

    expect(created.reference).toBe('LR-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/transactions`);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({
      productId: 'p1',
      quantity: 2,
      customer: CUSTOMER,
      delivery: DELIVERY,
    });
  });

  it('POSTs the payment to the reference-scoped path', async () => {
    const fetchMock = mockFetch([{ status: 202, body: { reference: 'LR-1', status: 'PENDING' } }]);
    const client = createHttpCheckoutClient(BASE);

    await client.pay('LR-1', {
      paymentToken: 'tok',
      acceptanceToken: 'acc',
      installments: 1,
    });

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/transactions/LR-1/pay`);
  });

  it('GETs a delivery by reference', async () => {
    const fetchMock = mockFetch([{ body: { reference: 'LR-1', status: 'ASSIGNED' } }]);
    const client = createHttpCheckoutClient(BASE);

    await expect(client.getDelivery('LR-1')).resolves.toMatchObject({ status: 'ASSIGNED' });
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/deliveries/LR-1`);
  });

  describe('errors', () => {
    it('turns the error envelope into an ApiError carrying the code', async () => {
      mockFetch([
        {
          ok: false,
          status: 409,
          body: { error: { code: 'OUT_OF_STOCK', message: 'Only 2 packs left' } },
        },
      ]);
      const client = createHttpCheckoutClient(BASE);

      const error = await client.listProducts().catch((e) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.code).toBe('OUT_OF_STOCK');
      expect(error.message).toBe('Only 2 packs left');
      expect(error.status).toBe(409);
    });

    it('keeps the field details from VALIDATION_FAILED', async () => {
      mockFetch([
        {
          ok: false,
          status: 400,
          body: {
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Invalid request',
              details: [{ field: 'customer.email', message: 'must be an email' }],
            },
          },
        },
      ]);
      const client = createHttpCheckoutClient(BASE);

      const error = await client
        .createTransaction({ productId: 'p', quantity: 1, customer: CUSTOMER, delivery: DELIVERY })
        .catch((e) => e);
      expect(error.details).toEqual([{ field: 'customer.email', message: 'must be an email' }]);
    });

    it('falls back to INTERNAL_ERROR when the body is not the envelope', async () => {
      mockFetch([{ ok: false, status: 502, body: { nope: true } }]);
      const client = createHttpCheckoutClient(BASE);

      const error = await client.listProducts().catch((e) => e);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.status).toBe(502);
    });

    it('survives a non-JSON error body', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 504,
        statusText: 'Gateway Timeout',
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      const client = createHttpCheckoutClient(BASE);

      const error = await client.listProducts().catch((e) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.message).toBe('Gateway Timeout');
    });
  });
});
