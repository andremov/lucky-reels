import { ok } from '../../shared/result/result';
import { GetTransaction } from './get-transaction';
import {
  aTransaction,
  FailingTransactionRepository,
  FakeTransactionRepository,
} from './transaction-repository.fake';

describe('GetTransaction', () => {
  const settled = aTransaction({
    reference: 'LR-SETTLED1',
    status: 'APPROVED',
    creditsGranted: 20,
    playerToken: 'plr_abc',
    settledAt: '2026-08-28T00:10:00.000Z',
  });

  const repository = new FakeTransactionRepository(ok(aTransaction()), [
    aTransaction({ reference: 'LR-PENDING1' }),
    settled,
  ]);

  it('finds a pending transaction', async () => {
    const result = await new GetTransaction(repository).execute('LR-PENDING1');

    expect(result.match({ ok: (t) => t.status, err: () => null })).toBe('PENDING');
  });

  it('withholds credits and the player token while pending', async () => {
    const result = await new GetTransaction(repository).execute('LR-PENDING1');

    const t = result.match({ ok: (x) => x, err: () => null });
    expect(t?.creditsGranted).toBeUndefined();
    expect(t?.playerToken).toBeUndefined();
  });

  it('exposes credits and the player token once approved', async () => {
    const result = await new GetTransaction(repository).execute('LR-SETTLED1');

    const t = result.match({ ok: (x) => x, err: () => null });
    expect(t?.creditsGranted).toBe(20);
    expect(t?.playerToken).toBe('plr_abc');
    expect(t?.settledAt).toBe('2026-08-28T00:10:00.000Z');
  });

  it('fails with TRANSACTION_NOT_FOUND for an unknown reference', async () => {
    const result = await new GetTransaction(repository).execute('LR-NOPE');

    expect(result.match({ ok: () => 'ok', err: (e) => e.code })).toBe('TRANSACTION_NOT_FOUND');
  });

  it('does not disguise an infrastructure failure as a missing transaction', async () => {
    const result = await new GetTransaction(new FailingTransactionRepository()).execute('LR-X');

    expect(result.match({ ok: () => 'ok', err: (e) => e.code })).toBe('INTERNAL_ERROR');
  });
});
