import { ok } from '../../shared/result/result';
import type { ChargeInput, ChargeOutcome, PaymentGateway } from '../../payments/domain/payment-gateway';
import { PayTransaction } from './pay-transaction';
import {
  aTransaction,
  FailingTransactionRepository,
  FakeTransactionRepository,
} from './transaction-repository.fake';

class RecordingGateway implements PaymentGateway {
  readonly charges: ChargeInput[] = [];

  constructor(private readonly outcome: ChargeOutcome = { result: 'APPROVED', gatewayTransactionId: 'g1' }) {}

  charge(input: ChargeInput): Promise<ChargeOutcome> {
    this.charges.push(input);
    return Promise.resolve(this.outcome);
  }
}

class ExplodingGateway implements PaymentGateway {
  charge(): Promise<ChargeOutcome> {
    return Promise.reject(new Error('gateway timeout'));
  }
}

const PENDING = aTransaction({ reference: 'LR-PENDING1', status: 'PENDING' });

const repositoryWith = (...stored: ReturnType<typeof aTransaction>[]) =>
  new FakeTransactionRepository(ok(aTransaction()), stored);

const at = (iso: string) => () => new Date(iso);
const BEFORE_EXPIRY = at('2026-08-28T00:05:00.000Z');
const AFTER_EXPIRY = at('2026-08-29T00:00:00.000Z');

const pay = (reference = 'LR-PENDING1', paymentToken = 'tok_ok') => ({
  reference,
  paymentToken,
  installments: 1,
});

describe('PayTransaction', () => {
  it('charges the gateway for the full total, not the product price alone', async () => {
    const repository = repositoryWith(PENDING);
    const gateway = new RecordingGateway();

    await new PayTransaction(repository, gateway, BEFORE_EXPIRY).execute(pay());

    expect(gateway.charges[0]).toMatchObject({
      reference: 'LR-PENDING1',
      amountCents: PENDING.amounts.totalCents,
      currency: 'COP',
    });
  });

  it('settles the transaction with the gateway outcome', async () => {
    const repository = repositoryWith(PENDING);

    const result = await new PayTransaction(repository, new RecordingGateway(), BEFORE_EXPIRY).execute(
      pay(),
    );

    expect(repository.settled).toEqual([
      { reference: 'LR-PENDING1', outcome: { result: 'APPROVED', gatewayTransactionId: 'g1' } },
    ]);
    expect(result.match({ ok: (t) => t.status, err: () => null })).toBe('APPROVED');
  });

  it('grants credits only on approval', async () => {
    const repository = repositoryWith(PENDING);

    const result = await new PayTransaction(repository, new RecordingGateway(), BEFORE_EXPIRY).execute(
      pay(),
    );

    expect(result.match({ ok: (t) => t.creditsGranted, err: () => null })).toBe(20);
  });

  it('settles a decline without granting credits', async () => {
    const repository = repositoryWith(PENDING);
    const gateway = new RecordingGateway({
      result: 'DECLINED',
      gatewayTransactionId: 'g2',
      reason: 'no',
    });

    const result = await new PayTransaction(repository, gateway, BEFORE_EXPIRY).execute(pay());

    const transaction = result.match({ ok: (t) => t, err: () => null });
    expect(transaction?.status).toBe('DECLINED');
    expect(transaction?.creditsGranted).toBeUndefined();
  });

  it('settles a gateway error as ERROR rather than throwing', async () => {
    const repository = repositoryWith(PENDING);
    const gateway = new RecordingGateway({ result: 'ERROR', reason: 'upstream down' });

    const result = await new PayTransaction(repository, gateway, BEFORE_EXPIRY).execute(pay());

    expect(result.match({ ok: (t) => t.status, err: () => null })).toBe('ERROR');
  });

  it('refuses an unknown reference before charging anything', async () => {
    const gateway = new RecordingGateway();

    const result = await new PayTransaction(repositoryWith(), gateway, BEFORE_EXPIRY).execute(
      pay('LR-NOPE'),
    );

    expect(result.match({ ok: () => 'ok', err: (e) => e.code })).toBe('TRANSACTION_NOT_FOUND');
    expect(gateway.charges).toHaveLength(0);
  });

  it('returns a settled transaction as it stands instead of charging again', async () => {
    const settled = aTransaction({
      reference: 'LR-DONE1',
      status: 'APPROVED',
      creditsGranted: 20,
    });
    const gateway = new RecordingGateway();

    const result = await new PayTransaction(repositoryWith(settled), gateway, BEFORE_EXPIRY).execute(
      pay('LR-DONE1'),
    );

    expect(result.match({ ok: (t) => t.status, err: () => null })).toBe('APPROVED');
    expect(gateway.charges).toHaveLength(0);
  });

  it('does not re-charge a declined transaction either', async () => {
    const declined = aTransaction({ reference: 'LR-NO1', status: 'DECLINED' });
    const gateway = new RecordingGateway();

    const result = await new PayTransaction(repositoryWith(declined), gateway, BEFORE_EXPIRY).execute(
      pay('LR-NO1'),
    );

    expect(result.match({ ok: (t) => t.status, err: () => null })).toBe('DECLINED');
    expect(gateway.charges).toHaveLength(0);
  });

  it('refuses to charge a lapsed reservation', async () => {
    const repository = repositoryWith(PENDING);
    const gateway = new RecordingGateway();

    const result = await new PayTransaction(repository, gateway, AFTER_EXPIRY).execute(pay());

    expect(result.match({ ok: () => 'ok', err: (e) => e.code })).toBe('TRANSACTION_EXPIRED');
    expect(gateway.charges).toHaveLength(0);
  });

  it('turns a gateway that throws into a domain error', async () => {
    const result = await new PayTransaction(
      repositoryWith(PENDING),
      new ExplodingGateway(),
      BEFORE_EXPIRY,
    ).execute(pay());

    expect(result.match({ ok: () => 'ok', err: (e) => e.code })).toBe('INTERNAL_ERROR');
  });

  it('turns a dead repository into a domain error', async () => {
    const result = await new PayTransaction(
      new FailingTransactionRepository(),
      new RecordingGateway(),
      BEFORE_EXPIRY,
    ).execute(pay());

    expect(result.match({ ok: () => 'ok', err: (e) => e.code })).toBe('INTERNAL_ERROR');
  });

  it('passes the token through so the gateway decides, not the caller', async () => {
    const gateway = new RecordingGateway();

    await new PayTransaction(repositoryWith(PENDING), gateway, BEFORE_EXPIRY).execute(
      pay('LR-PENDING1', 'tok_decline_me'),
    );

    expect(gateway.charges[0].paymentToken).toBe('tok_decline_me');
  });
});
