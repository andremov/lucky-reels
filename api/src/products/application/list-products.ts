import { ResultAsync } from '../../shared/result/result';
import { internalError, toProductView, type ProductError, type ProductView } from '../domain/product';
import type { ProductRepository } from './product-repository';

export class ListProducts {
  constructor(private readonly products: ProductRepository) {}

  execute(): ResultAsync<ProductView[], ProductError> {
    return ResultAsync.fromPromise(this.products.findAll(), internalError).map((stored) =>
      stored.map(({ product, stock }) => toProductView(product, stock)),
    );
  }
}
