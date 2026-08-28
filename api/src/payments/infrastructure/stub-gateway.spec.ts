import type { ChargeInput } from '../domain/payment-gateway';
import { StubGateway } from './stub-gateway';

const charge = (paymentToken: string): ChargeInput => ({
  reference: 'LR-ABC12345',
  amountCents: 2_230_000,
  currency: 'COP',
  paymentToken,
  installments: 1,
  customerEmail: 'buyer@example.test',
});

/** A real token id from the provider's sandbox, shape preserved. */
const REAL_PROVIDER_TOKEN = 'tok_stagtest_5113_B2Ff12B86b499b9361e2C14f0aD2b2a2';

describe('StubGateway', () => {
  const gateway = new StubGateway();

  describe('the tokens it owns', () => {
    it('approves the frontend approving token', async () => {
      const outcome = await gateway.charge(charge('tok_stagtest_ok_visa_4242'));

      expect(outcome.result).toBe('APPROVED');
    });

    it('declines the frontend declining token', async () => {
      const outcome = await gateway.charge(charge('tok_stagtest_decline_visa_0002'));

      expect(outcome.result).toBe('DECLINED');
    });

    it('errors on the frontend erroring token', async () => {
      const outcome = await gateway.charge(charge('tok_stagtest_error_visa_0119'));

      expect(outcome.result).toBe('ERROR');
    });

    it.each([
      ['tok_ok', 'APPROVED'],
      ['tok_approve', 'APPROVED'],
      ['tok_decline', 'DECLINED'],
      ['tok_error', 'ERROR'],
    ])('resolves the documented bare token %s as %s', async (token, expected) => {
      expect((await gateway.charge(charge(token))).result).toBe(expected);
    });

    it('returns a traceable id on approval', async () => {
      const outcome = await gateway.charge(charge('tok_ok'));

      if (outcome.result === 'APPROVED') {
        expect(outcome.gatewayTransactionId).toMatch(/^stub_[0-9a-f]{12}$/);
      }
    });

    it('is deterministic for the same token', async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }, () => gateway.charge(charge('tok_stagtest_decline_visa_0002'))),
      );

      expect(results.every((r) => r.result === 'DECLINED')).toBe(true);
    });
  });

  describe('tokens it does not own', () => {
    it('REFUSES A REAL PROVIDER TOKEN rather than approving it', async () => {
      const outcome = await gateway.charge(charge(REAL_PROVIDER_TOKEN));

      expect(outcome.result).toBe('ERROR');
    });

    it('says why, so a misconfiguration is diagnosable', async () => {
      const outcome = await gateway.charge(charge(REAL_PROVIDER_TOKEN));

      if (outcome.result === 'ERROR') {
        expect(outcome.reason).toMatch(/unrecognised stub token/i);
      }
    });

    it('is not fooled by the substring "ok", which every token contains via "tok_"', async () => {
      expect(REAL_PROVIDER_TOKEN.toLowerCase()).toContain('ok');

      const outcome = await gateway.charge(charge(REAL_PROVIDER_TOKEN));

      expect(outcome.result).not.toBe('APPROVED');
    });

    it.each([
      'tok_stagtest_5113_deadbeef',
      'tok_okay_visa_4242',
      'ok',
      'approve',
      'tok_ok_extra',
      '',
      'null',
    ])('refuses %p', async (token) => {
      expect((await gateway.charge(charge(token))).result).toBe('ERROR');
    });

    it('matches from the start, so a decline word later in the string does not count', async () => {
      const outcome = await gateway.charge(charge('tok_stagtest_5113_declineXYZ'));

      expect(outcome.result).toBe('ERROR');
    });
  });
});
