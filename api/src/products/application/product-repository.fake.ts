import type { Product } from '../domain/product';
import type { ProductRepository, StoredProduct } from './product-repository';

export const aProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: 'Starter Pack',
  description: '20 spins on the Lucky Reels machine',
  priceCents: 2_000_000,
  currency: 'COP',
  imageUrl: 'https://example.test/starter.png',
  spinsGranted: 20,
  ...overrides,
});

export const aStoredProduct = (
  product: Partial<Product> = {},
  stock: { available?: number; reserved?: number } = {},
): StoredProduct => {
  const built = aProduct(product);

  return {
    product: built,
    stock: {
      productId: built.id,
      available: stock.available ?? 5,
      reserved: stock.reserved ?? 0,
    },
  };
};

export class FakeProductRepository implements ProductRepository {
  constructor(private readonly items: StoredProduct[] = []) {}

  findAll(): Promise<StoredProduct[]> {
    return Promise.resolve(this.items);
  }

  findById(id: string): Promise<StoredProduct | null> {
    return Promise.resolve(this.items.find((i) => i.product.id === id) ?? null);
  }
}

export class FailingProductRepository implements ProductRepository {
  constructor(private readonly reason: unknown = new Error('connection lost')) {}

  findAll(): Promise<StoredProduct[]> {
    return Promise.reject(this.reason);
  }

  findById(): Promise<StoredProduct | null> {
    return Promise.reject(this.reason);
  }
}
