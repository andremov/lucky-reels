import { ListProducts } from './list-products';
import {
  aStoredProduct,
  FailingProductRepository,
  FakeProductRepository,
} from './product-repository.fake';

describe('ListProducts', () => {
  it('returns an empty list when the catalogue is empty', async () => {
    const result = await new ListProducts(new FakeProductRepository()).execute();

    expect(result.match({ ok: (p) => p, err: () => null })).toEqual([]);
  });

  it('exposes only what a buyer needs to see', async () => {
    const repository = new FakeProductRepository([
      aStoredProduct({ id: 'p1', name: 'Starter Pack' }, { available: 7 }),
    ]);

    const result = await new ListProducts(repository).execute();
    const [product] = result.match({ ok: (p) => p, err: () => [] });

    expect(product).toEqual({
      id: 'p1',
      name: 'Starter Pack',
      description: '20 spins on the Lucky Reels machine',
      priceCents: 2_000_000,
      currency: 'COP',
      imageUrl: 'https://example.test/starter.png',
      spinsGranted: 20,
      stock: { available: 7 },
    });
  });

  it('hides how many units are reserved', async () => {
    const repository = new FakeProductRepository([
      aStoredProduct({ id: 'p1' }, { available: 2, reserved: 8 }),
    ]);

    const result = await new ListProducts(repository).execute();
    const [product] = result.match({ ok: (p) => p, err: () => [] });

    expect(product.stock).toEqual({ available: 2 });
    expect(JSON.stringify(product)).not.toContain('reserved');
  });

  it('keeps every product in the catalogue', async () => {
    const repository = new FakeProductRepository([
      aStoredProduct({ id: 'p1' }),
      aStoredProduct({ id: 'p2' }),
      aStoredProduct({ id: 'p3' }),
    ]);

    const result = await new ListProducts(repository).execute();

    expect(result.match({ ok: (p) => p.map((x) => x.id), err: () => [] })).toEqual([
      'p1',
      'p2',
      'p3',
    ]);
  });

  it('turns a dead repository into a domain error rather than a throw', async () => {
    const result = await new ListProducts(new FailingProductRepository()).execute();

    expect(result.match({ ok: () => 'ok', err: (e) => e.code })).toBe('INTERNAL_ERROR');
  });

  it('copes with a rejection that is not an Error', async () => {
    const repository = new FailingProductRepository('socket hang up');

    const result = await new ListProducts(repository).execute();

    expect(result.match({ ok: () => '', err: (e) => e.message })).toBe('Unexpected failure');
  });

  it('carries the underlying reason on the failure track', async () => {
    const repository = new FailingProductRepository(new Error('pool exhausted'));

    const result = await new ListProducts(repository).execute();

    expect(result.match({ ok: () => '', err: (e) => e.message })).toBe('pool exhausted');
  });
});
