import type { StockSnapshot } from '../../stock/domain/stock';
import type { Product } from '../domain/product';

export type StoredProduct = {
  product: Product;
  stock: StockSnapshot;
};

export interface ProductRepository {
  findAll(): Promise<StoredProduct[]>;
  findById(id: string): Promise<StoredProduct | null>;
}

export const PRODUCT_REPOSITORY = Symbol('ProductRepository');
