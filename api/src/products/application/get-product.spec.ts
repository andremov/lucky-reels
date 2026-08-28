import { GetProduct } from './get-product';
import {
  aStoredProduct,
  FailingProductRepository,
  FakeProductRepository,
} from './product-repository.fake';

describe('GetProduct', () => {
  const repository = new FakeProductRepository([
    aStoredProduct({ id: 'p1', name: 'Starter Pack' }, { available: 3, reserved: 2 }),
    aStoredProduct({ id: 'p2', name: 'High Roller' }, { available: 0 }),
  ]);

  it('finds a product by id', async () => {
    const result = await new GetProduct(repository).execute('p1');

    expect(result.match({ ok: (p) => p.name, err: () => null })).toBe('Starter Pack');
  });

  it('reports availability without leaking reservations', async () => {
    const result = await new GetProduct(repository).execute('p1');

    expect(result.match({ ok: (p) => p.stock, err: () => null })).toEqual({ available: 3 });
  });

  it('still returns a sold out product rather than hiding it', async () => {
    const result = await new GetProduct(repository).execute('p2');

    expect(result.match({ ok: (p) => p.stock.available, err: () => -1 })).toBe(0);
  });

  it('fails with PRODUCT_NOT_FOUND for an unknown id', async () => {
    const result = await new GetProduct(repository).execute('nope');

    expect(result.match({ ok: () => 'ok', err: (e) => e.code })).toBe('PRODUCT_NOT_FOUND');
  });

  it('names the id it could not find', async () => {
    const result = await new GetProduct(repository).execute('ghost');

    expect(result.match({ ok: () => '', err: (e) => e.message })).toContain('ghost');
  });

  it('distinguishes a missing product from a broken repository', async () => {
    const result = await new GetProduct(new FailingProductRepository()).execute('p1');

    expect(result.match({ ok: () => 'ok', err: (e) => e.code })).toBe('INTERNAL_ERROR');
  });
});
