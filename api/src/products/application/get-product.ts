import { err, ok, ResultAsync } from '../../shared/result/result';
import {
  internalError,
  productNotFound,
  toProductView,
  type ProductError,
  type ProductView,
} from '../domain/product';
import type { ProductRepository } from './product-repository';

export class GetProduct {
  constructor(private readonly products: ProductRepository) {}

  execute(id: string): ResultAsync<ProductView, ProductError> {
    return ResultAsync.fromPromise(this.products.findById(id), internalError).andThen((found) =>
      found ? ok(toProductView(found.product, found.stock)) : err(productNotFound(id)),
    );
  }
}
