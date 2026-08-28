import { ProductEntity } from './product.entity';
import { StockEntity } from './stock.entity';
import { toStoredProduct } from './typeorm-product.repository';

const row = (overrides: Partial<ProductEntity> = {}): ProductEntity =>
  Object.assign(new ProductEntity(), {
    id: 'p1',
    name: 'Starter Pack',
    description: '20 spins',
    priceCents: '2000000',
    currency: 'COP',
    imageUrl: 'https://example.test/a.png',
    spinsGranted: 20,
    ...overrides,
  });

const stockRow = (overrides: Partial<StockEntity> = {}): StockEntity =>
  Object.assign(new StockEntity(), {
    id: 's1',
    productId: 'p1',
    available: 5,
    reserved: 2,
    ...overrides,
  });

describe('toStoredProduct', () => {
  it('converts the bigint price back to a number', () => {
    const { product } = toStoredProduct(row({ priceCents: '15000000' }), stockRow());

    expect(product.priceCents).toBe(15_000_000);
    expect(typeof product.priceCents).toBe('number');
  });

  it('keeps a large price exact rather than losing precision', () => {
    const { product } = toStoredProduct(row({ priceCents: '9007199254740991' }), stockRow());

    expect(product.priceCents).toBe(9_007_199_254_740_991);
  });

  it('carries the stock counts through', () => {
    const { stock } = toStoredProduct(row(), stockRow({ available: 7, reserved: 3 }));

    expect(stock).toEqual({ productId: 'p1', available: 7, reserved: 3 });
  });

  it('treats a product with no stock row as sold out rather than crashing', () => {
    const { stock } = toStoredProduct(row(), null);

    expect(stock).toEqual({ productId: 'p1', available: 0, reserved: 0 });
  });

  it('treats a missing stock row the same when undefined', () => {
    const { stock } = toStoredProduct(row(), undefined);

    expect(stock).toEqual({ productId: 'p1', available: 0, reserved: 0 });
  });

  it('always reports COP regardless of what the column holds', () => {
    const { product } = toStoredProduct(row({ currency: 'USD' }), stockRow());

    expect(product.currency).toBe('COP');
  });

  it('maps the catalogue fields verbatim', () => {
    const { product } = toStoredProduct(row(), stockRow());

    expect(product).toMatchObject({
      id: 'p1',
      name: 'Starter Pack',
      description: '20 spins',
      imageUrl: 'https://example.test/a.png',
      spinsGranted: 20,
    });
  });
});
