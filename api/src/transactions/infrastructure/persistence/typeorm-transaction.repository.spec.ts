import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { TypeormTransactionRepository } from './typeorm-transaction.repository';
import type { CreateTransactionInput } from '../../application/transaction-repository';

/**
 * Runs against the real database. The reservation invariant is about two
 * connections racing for the same row, which an in-memory fake cannot express.
 * Skipped when DATABASE_URL is absent so a clean checkout still passes.
 */
const CA_PATH = join(__dirname, '..', '..', '..', '..', 'certs', 'supabase-ca.crt');
const url = process.env.DATABASE_URL;
const describeIfDb = url ? describe : describe.skip;

jest.setTimeout(60_000);

describeIfDb('TypeormTransactionRepository (integration)', () => {
  let dataSource: DataSource;
  let repository: TypeormTransactionRepository;
  let productId: string;

  const input = (email: string, quantity = 1): CreateTransactionInput => ({
    productId,
    quantity,
    customer: { email, fullName: 'Race Tester', phone: '+573000000000' },
    delivery: {
      addressLine: 'Calle 1',
      city: 'Bogota',
      region: 'Cundinamarca',
      postalCode: '110111',
    },
  });

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url,
      ssl: existsSync(CA_PATH)
        ? { ca: readFileSync(CA_PATH, 'utf8'), rejectUnauthorized: true }
        : undefined,
    });
    await dataSource.initialize();
    repository = new TypeormTransactionRepository(dataSource);

    const rows: { id: string }[] = await dataSource.query(
      `insert into products (name, description, price_cents, currency, image_url, spins_granted)
       values ('__test pack', 'integration test', 100000, 'COP', 'https://x.test/a.png', 5)
       on conflict (name) do update set description = excluded.description
       returning id`,
    );
    productId = rows[0].id;
  });

  afterAll(async () => {
    if (!dataSource?.isInitialized) return;

    await dataSource.query(
      `delete from deliveries where transaction_id in
         (select id from transactions where product_id = $1)`,
      [productId],
    );
    await dataSource.query('delete from transactions where product_id = $1', [productId]);
    await dataSource.query('delete from stock where product_id = $1', [productId]);
    await dataSource.query('delete from products where id = $1', [productId]);
    await dataSource.query(`delete from customers where email like '%@race.test'`);
    await dataSource.destroy();
  });

  const setStock = (available: number) =>
    dataSource.query(
      `insert into stock (product_id, available, reserved) values ($1, $2, 0)
       on conflict (product_id) do update set available = excluded.available, reserved = 0`,
      [productId, available],
    );

  const deliveryStatusFor = async (reference: string): Promise<string> => {
    const rows = await dataSource.query(
      `select d.status from deliveries d
         join transactions t on t.id = d.transaction_id
        where t.reference = $1`,
      [reference],
    );
    return rows[0]?.status;
  };

  const stockNow = async (): Promise<{ available: number; reserved: number }> => {
    const rows = await dataSource.query(
      'select available, reserved from stock where product_id = $1',
      [productId],
    );
    return rows[0];
  };

  it('reserves stock when it creates the transaction', async () => {
    await setStock(5);

    const result = await repository.createPending(input('one@race.test'));

    expect(result.isOk()).toBe(true);
    expect(await stockNow()).toEqual({ available: 4, reserved: 1 });
  });

  it('refuses to reserve more than exists', async () => {
    await setStock(2);

    const result = await repository.createPending(input('two@race.test', 3));

    expect(result.match({ ok: () => 'ok', err: (e) => e.code })).toBe('OUT_OF_STOCK');
    expect(await stockNow()).toEqual({ available: 2, reserved: 0 });
  });

  it('refuses an unknown product', async () => {
    const result = await repository.createPending({
      ...input('three@race.test'),
      productId: '00000000-0000-0000-0000-000000000000',
    });

    expect(result.match({ ok: () => 'ok', err: (e) => e.code })).toBe('PRODUCT_NOT_FOUND');
  });

  it('lets exactly one of two concurrent buyers take the last unit', async () => {
    await setStock(1);

    const [a, b] = await Promise.all([
      repository.createPending(input('race-a@race.test')),
      repository.createPending(input('race-b@race.test')),
    ]);

    const succeeded = [a, b].filter((r) => r.isOk());
    const failed = [a, b].filter((r) => r.isErr());

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].match({ ok: () => '', err: (e) => e.code })).toBe('OUT_OF_STOCK');
    expect(await stockNow()).toEqual({ available: 0, reserved: 1 });
  });

  it('commits the reservation when the payment is approved', async () => {
    await setStock(3);
    const created = await repository.createPending(input('approve@race.test'));
    const reference = created.match({ ok: (t) => t.reference, err: () => '' });

    const settled = await repository.settle(reference, {
      result: 'APPROVED',
      gatewayTransactionId: 'g-int-1',
    });

    expect(settled.match({ ok: (t) => t.status, err: () => null })).toBe('APPROVED');
    expect(settled.match({ ok: (t) => t.creditsGranted, err: () => null })).toBe(5);
    expect(await stockNow()).toEqual({ available: 2, reserved: 0 });
    expect(await deliveryStatusFor(reference)).toBe('ASSIGNED');
  });

  it('hands the reservation back when the payment is declined', async () => {
    await setStock(3);
    const created = await repository.createPending(input('decline@race.test'));
    const reference = created.match({ ok: (t) => t.reference, err: () => '' });

    const settled = await repository.settle(reference, {
      result: 'DECLINED',
      gatewayTransactionId: 'g-int-2',
      reason: 'no',
    });

    expect(settled.match({ ok: (t) => t.status, err: () => null })).toBe('DECLINED');
    expect(await stockNow()).toEqual({ available: 3, reserved: 0 });
    expect(await deliveryStatusFor(reference)).toBe('PENDING');
  });

  it('settles a second time without paying twice', async () => {
    await setStock(3);
    const created = await repository.createPending(input('twice@race.test'));
    const reference = created.match({ ok: (t) => t.reference, err: () => '' });

    await repository.settle(reference, { result: 'APPROVED', gatewayTransactionId: 'g-int-3' });
    const again = await repository.settle(reference, {
      result: 'DECLINED',
      gatewayTransactionId: 'g-int-4',
      reason: 'late',
    });

    expect(again.match({ ok: (t) => t.status, err: () => null })).toBe('APPROVED');
    expect(await stockNow()).toEqual({ available: 2, reserved: 0 });
  });

  it('reports an unknown reference rather than inventing one', async () => {
    const settled = await repository.settle('LR-NOTHERE', {
      result: 'APPROVED',
      gatewayTransactionId: 'g-int-5',
    });

    expect(settled.match({ ok: () => 'ok', err: (e) => e.code })).toBe('TRANSACTION_NOT_FOUND');
  });

  it('reads back a transaction by reference', async () => {
    await setStock(3);
    const created = await repository.createPending(input('read@race.test'));
    const reference = created.match({ ok: (t) => t.reference, err: () => '' });

    const found = await repository.findByReference(reference);

    expect(found?.reference).toBe(reference);
    expect(found?.status).toBe('PENDING');
    expect(found?.playerToken).toBeUndefined();
  });

  it('returns null for a reference that does not exist', async () => {
    expect(await repository.findByReference('LR-GHOST')).toBeNull();
  });
});
