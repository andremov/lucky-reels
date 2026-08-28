import type { ChargeInput } from '../domain/payment-gateway';
import { StubGateway } from './stub-gateway';

const charge = (paymentToken: string): ChargeInput => ({
  reference: 'LR-ABC12345',
  amountCents: 2_230_000,
  currency: 'COP',
  paymentToken,
  installments: 1,
});

describe('StubGateway', () => {
  const gateway = new StubGateway();

  it('approves an ordinary token', async () => {
    const outcome = await gateway.charge(charge('tok_test_visa_4242'));

    expect(outcome.result).toBe('APPROVED');
  });

  it('returns a gateway id on approval so the charge is traceable', async () => {
    const outcome = await gateway.charge(charge('tok_ok'));

    expect(outcome).toMatchObject({ result: 'APPROVED', gatewayTransactionId: /stub_/ as never });
    if (outcome.result === 'APPROVED') {
      expect(outcome.gatewayTransactionId).toMatch(/^stub_[0-9a-f]{12}$/);
    }
  });

  it('declines a token asking to be declined', async () => {
    const outcome = await gateway.charge(charge('tok_decline_me'));

    expect(outcome.result).toBe('DECLINED');
  });

  it('gives a reason for a decline', async () => {
    const outcome = await gateway.charge(charge('tok_decline'));

    if (outcome.result === 'DECLINED') {
      expect(outcome.reason).toMatch(/declined/i);
    }
  });

  it('errors on a token asking for an error', async () => {
    const outcome = await gateway.charge(charge('tok_error'));

    expect(outcome.result).toBe('ERROR');
  });

  it('ignores case, so DECLINE works as well as decline', async () => {
    const outcome = await gateway.charge(charge('TOK_DECLINE'));

    expect(outcome.result).toBe('DECLINED');
  });

  it('prefers error over decline when a token asks for both', async () => {
    const outcome = await gateway.charge(charge('tok_error_decline'));

    expect(outcome.result).toBe('ERROR');
  });

  it('is deterministic: the same token always gives the same result', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => gateway.charge(charge('tok_decline'))),
    );

    expect(results.every((r) => r.result === 'DECLINED')).toBe(true);
  });

  it('gives a different gateway id per charge', async () => {
    const a = await gateway.charge(charge('tok_ok'));
    const b = await gateway.charge(charge('tok_ok'));

    if (a.result === 'APPROVED' && b.result === 'APPROVED') {
      expect(a.gatewayTransactionId).not.toBe(b.gatewayTransactionId);
    }
  });
});
