import { err } from '../../shared/result/result';
import { outOfStock, productNotFound } from '../domain/transaction';
import { CreateTransaction } from './create-transaction';
import {
  anInput,
  aTransaction,
  FailingTransactionRepository,
  FakeTransactionRepository,
} from './transaction-repository.fake';
import { ok } from '../../shared/result/result';

describe('CreateTransaction', () => {
  it('returns the pending transaction', async () => {
    const repository = new FakeTransactionRepository(ok(aTransaction({ reference: 'LR-ABC12345' })));

    const result = await new CreateTransaction(repository).execute(anInput());

    expect(result.match({ ok: (t) => t.reference, err: () => null })).toBe('LR-ABC12345');
  });

  it('starts life as PENDING, never as settled', async () => {
    const repository = new FakeTransactionRepository();

    const result = await new CreateTransaction(repository).execute(anInput());

    expect(result.match({ ok: (t) => t.status, err: () => null })).toBe('PENDING');
  });

  it('passes the order through untouched', async () => {
    const repository = new FakeTransactionRepository();
    const input = anInput({ quantity: 3 });

    await new CreateTransaction(repository).execute(input);

    expect(repository.created).toEqual([input]);
  });

  it('surfaces a sold out product as OUT_OF_STOCK rather than creating anything', async () => {
    const repository = new FakeTransactionRepository(err(outOfStock(0)));

    const result = await new CreateTransaction(repository).execute(anInput());

    expect(result.match({ ok: () => 'ok', err: (e) => e.code })).toBe('OUT_OF_STOCK');
  });

  it('reports how many remain when it refuses', async () => {
    const repository = new FakeTransactionRepository(err(outOfStock(2)));

    const result = await new CreateTransaction(repository).execute(anInput({ quantity: 5 }));

    const available = result.match({
      ok: () => -1,
      err: (e) => (e.code === 'OUT_OF_STOCK' ? e.available : -1),
    });

    expect(available).toBe(2);
  });

  it('surfaces an unknown product', async () => {
    const repository = new FakeTransactionRepository(err(productNotFound('ghost')));

    const result = await new CreateTransaction(repository).execute(anInput());

    expect(result.match({ ok: () => 'ok', err: (e) => e.code })).toBe('PRODUCT_NOT_FOUND');
  });

  it('turns a dead repository into a domain error rather than a throw', async () => {
    const result = await new CreateTransaction(new FailingTransactionRepository()).execute(
      anInput(),
    );

    expect(result.match({ ok: () => 'ok', err: (e) => e.code })).toBe('INTERNAL_ERROR');
  });
});
