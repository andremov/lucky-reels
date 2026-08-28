import type { ChargeInput } from '../domain/payment-gateway';
import {
  GatewayTimeoutError,
  GatewayUnavailableError,
  LiveGateway,
  mapStatus,
  POLL_BUDGET_MS,
  signature,
} from './live-gateway';

const CONFIG = {
  apiUrl: 'https://api.example.test/v1',
  publicKey: 'pub_test',
  privateKey: 'prv_test',
  integrityKey: 'int_test',
};

const input = (overrides: Partial<ChargeInput> = {}): ChargeInput => ({
  reference: 'LR-ABC12345',
  amountCents: 2_230_000,
  currency: 'COP',
  paymentToken: 'tok_stagtest_5113_abc',
  installments: 1,
  customerEmail: 'buyer@example.test',
  ...overrides,
});

const ok = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

/** Drives the clock forward by the poll interval on every sleep. */
function harness(responses: (url: string) => unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let clock = 0;

  const gateway = new LiveGateway(CONFIG, {
    fetch: ((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(responses(url));
    }) as unknown as typeof fetch,
    now: () => clock,
    sleep: (ms: number) => {
      clock += ms;
      return Promise.resolve();
    },
  });

  return { gateway, calls, advance: (ms: number) => (clock += ms) };
}

const MERCHANT = { data: { presigned_acceptance: { acceptance_token: 'acc_123' } } };

const respondWith = (statuses: string[]) => {
  let i = 0;
  return (url: string) => {
    if (url.includes('/merchants/')) return ok(MERCHANT);
    if (url.endsWith('/transactions')) return ok({ data: { id: 'txn_1' } });
    return ok({ data: { status: statuses[Math.min(i++, statuses.length - 1)] } });
  };
};

describe('mapStatus', () => {
  it.each([
    ['APPROVED', 'APPROVED'],
    ['DECLINED', 'DECLINED'],
    ['PENDING', 'PENDING'],
    ['ERROR', 'ERROR'],
  ])('maps %s to %s', (theirs, ours) => {
    expect(mapStatus(theirs)).toBe(ours);
  });

  it('maps VOIDED to ERROR, not DECLINED', () => {
    expect(mapStatus('VOIDED')).toBe('ERROR');
  });

  it('maps a status it has never seen to ERROR rather than treating it as pending', () => {
    expect(mapStatus('SOMETHING_NEW')).toBe('ERROR');
    expect(mapStatus('')).toBe('ERROR');
  });
});

describe('signature', () => {
  it('is the sha256 of reference, amount, currency and the integrity key', () => {
    expect(signature('LR-1', 100, 'COP', 'secret')).toBe(
      require('node:crypto').createHash('sha256').update('LR-1100COPsecret').digest('hex'),
    );
  });

  it('changes when any input changes', () => {
    const base = signature('LR-1', 100, 'COP', 'secret');

    expect(signature('LR-2', 100, 'COP', 'secret')).not.toBe(base);
    expect(signature('LR-1', 101, 'COP', 'secret')).not.toBe(base);
    expect(signature('LR-1', 100, 'USD', 'secret')).not.toBe(base);
    expect(signature('LR-1', 100, 'COP', 'other')).not.toBe(base);
  });
});

describe('LiveGateway', () => {
  it('approves when the provider settles approved', async () => {
    const { gateway } = harness(respondWith(['APPROVED']));

    const outcome = await gateway.charge(input());

    expect(outcome).toEqual({ result: 'APPROVED', gatewayTransactionId: 'txn_1' });
  });

  it('declines when the provider declines, carrying their message', async () => {
    const { gateway } = harness((url) => {
      if (url.includes('/merchants/')) return ok(MERCHANT);
      if (url.endsWith('/transactions')) return ok({ data: { id: 'txn_1' } });
      return ok({ data: { status: 'DECLINED', status_message: 'Fondos insuficientes' } });
    });

    const outcome = await gateway.charge(input());

    expect(outcome).toMatchObject({ result: 'DECLINED', reason: 'Fondos insuficientes' });
  });

  it('treats a void as an error rather than a decline', async () => {
    const { gateway } = harness(respondWith(['VOIDED']));

    expect((await gateway.charge(input())).result).toBe('ERROR');
  });

  it('keeps polling while the provider says pending', async () => {
    const { gateway, calls } = harness(respondWith(['PENDING', 'PENDING', 'APPROVED']));

    const outcome = await gateway.charge(input());
    const polls = calls.filter((c) => c.url.includes('/transactions/txn_1')).length;

    expect(outcome.result).toBe('APPROVED');
    expect(polls).toBe(3);
  });

  it('THROWS rather than inventing an outcome when it never settles', async () => {
    const { gateway } = harness(respondWith(['PENDING']));

    await expect(gateway.charge(input())).rejects.toBeInstanceOf(GatewayTimeoutError);
  });

  it('names the reference in the timeout so it can be reconciled', async () => {
    const { gateway } = harness(respondWith(['PENDING']));

    await expect(gateway.charge(input({ reference: 'LR-STUCK1' }))).rejects.toThrow('LR-STUCK1');
  });

  it('gives up within its budget rather than running to the function limit', async () => {
    const { gateway } = harness(respondWith(['PENDING']));

    await expect(gateway.charge(input())).rejects.toThrow(String(POLL_BUDGET_MS));
  });

  it('fetches a FRESH acceptance token for every charge', async () => {
    const { gateway, calls } = harness(respondWith(['APPROVED']));

    await gateway.charge(input());
    await gateway.charge(input());
    await gateway.charge(input());

    // The token is single use. Caching it would let only the first payment of a
    // process succeed and reject every one after it.
    expect(calls.filter((c) => c.url.includes('/merchants/'))).toHaveLength(3);
  });

  it('fetches the acceptance token before creating each transaction, in order', async () => {
    const { gateway, calls } = harness(respondWith(['APPROVED']));

    await gateway.charge(input());
    await gateway.charge(input());

    const sequence = calls
      .filter((c) => c.url.includes('/merchants/') || c.url.endsWith('/transactions'))
      .map((c) => (c.url.includes('/merchants/') ? 'acceptance' : 'create'));

    expect(sequence).toEqual(['acceptance', 'create', 'acceptance', 'create']);
  });

  it('throws before creating anything when the acceptance token cannot be fetched', async () => {
    const { gateway, calls } = harness((url) =>
      url.includes('/merchants/')
        ? { ok: false, status: 503, json: () => Promise.resolve({}) }
        : ok({ data: { id: 'txn_1' } }),
    );

    await expect(gateway.charge(input())).rejects.toBeInstanceOf(GatewayUnavailableError);
    expect(calls.filter((c) => c.url.endsWith('/transactions'))).toHaveLength(0);
  });

  it('throws when the provider rejects the transaction outright', async () => {
    const { gateway } = harness((url) =>
      url.includes('/merchants/')
        ? ok(MERCHANT)
        : { ok: false, status: 422, json: () => Promise.resolve({ error: { type: 'BAD' } }) },
    );

    await expect(gateway.charge(input())).rejects.toBeInstanceOf(GatewayUnavailableError);
  });

  it('authorises the merchant lookup with the public key and the charge with the private key', async () => {
    const { gateway, calls } = harness(respondWith(['APPROVED']));

    await gateway.charge(input());

    const merchant = calls.find((c) => c.url.includes('/merchants/'))!;
    const create = calls.find((c) => c.url.endsWith('/transactions'))!;

    expect(merchant.url).toContain(CONFIG.publicKey);
    expect((create.init?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${CONFIG.privateKey}`,
    );
  });

  it('sends the token, amount and signature the provider expects', async () => {
    const { gateway, calls } = harness(respondWith(['APPROVED']));

    await gateway.charge(input());
    const create = calls.find((c) => c.url.endsWith('/transactions'))!;
    const body = JSON.parse(create.init!.body as string);

    expect(body).toMatchObject({
      amount_in_cents: 2_230_000,
      currency: 'COP',
      reference: 'LR-ABC12345',
      acceptance_token: 'acc_123',
      customer_email: 'buyer@example.test',
      payment_method: { type: 'CARD', token: 'tok_stagtest_5113_abc', installments: 1 },
    });
    expect(body.signature).toBe(signature('LR-ABC12345', 2_230_000, 'COP', CONFIG.integrityKey));
  });

  it('supplies a decline reason when the provider sends none', async () => {
    const { gateway } = harness((url) => {
      if (url.includes('/merchants/')) return ok(MERCHANT);
      if (url.endsWith('/transactions')) return ok({ data: { id: 'txn_1' } });
      return ok({ data: { status: 'DECLINED' } });
    });

    expect(await gateway.charge(input())).toMatchObject({
      result: 'DECLINED',
      reason: 'Declined by the issuer',
    });
  });

  it('supplies an error reason when the provider sends none', async () => {
    const { gateway } = harness((url) => {
      if (url.includes('/merchants/')) return ok(MERCHANT);
      if (url.endsWith('/transactions')) return ok({ data: { id: 'txn_1' } });
      return ok({ data: { status: 'VOIDED' } });
    });

    expect(await gateway.charge(input())).toMatchObject({
      result: 'ERROR',
      reason: 'Payment did not complete',
    });
  });

  it('treats a merchant response with no acceptance token as unavailable', async () => {
    const { gateway } = harness((url) =>
      url.includes('/merchants/') ? ok({ data: {} }) : ok({ data: { id: 'txn_1' } }),
    );

    await expect(gateway.charge(input())).rejects.toThrow(/no acceptance token/i);
  });

  it('reports the provider status code when a transaction is refused', async () => {
    const { gateway } = harness((url) =>
      url.includes('/merchants/')
        ? ok(MERCHANT)
        : { ok: false, status: 422, json: () => Promise.resolve({}) },
    );

    await expect(gateway.charge(input())).rejects.toThrow(/422/);
  });

  it('copes with a poll response that carries no status at all', async () => {
    const { gateway } = harness((url) => {
      if (url.includes('/merchants/')) return ok(MERCHANT);
      if (url.endsWith('/transactions')) return ok({ data: { id: 'txn_1' } });
      return ok({});
    });

    expect((await gateway.charge(input())).result).toBe('ERROR');
  });
});
