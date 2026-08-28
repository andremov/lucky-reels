import { NotFoundException } from '@nestjs/common';
import { GetProduct } from '../../application/get-product';
import type { ProductRepository } from '../../application/product-repository';
import { ListProducts } from '../../application/list-products';
import {
  aStoredProduct,
  FailingProductRepository,
  FakeProductRepository,
} from '../../application/product-repository.fake';
import { ProductsController } from './products.controller';

const controllerFor = (
  repository: ProductRepository = new FakeProductRepository([aStoredProduct()]),
) => new ProductsController(new ListProducts(repository), new GetProduct(repository));

describe('ProductsController', () => {
  describe('list', () => {
    it('returns the catalogue', async () => {
      const repository = new FakeProductRepository([
        aStoredProduct({ id: 'p1' }, { available: 4 }),
        aStoredProduct({ id: 'p2' }, { available: 0 }),
      ]);

      const products = await controllerFor(repository).list();

      expect(products.map((p) => p.id)).toEqual(['p1', 'p2']);
    });

    it('does not leak reserved counts to the client', async () => {
      const repository = new FakeProductRepository([
        aStoredProduct({ id: 'p1' }, { available: 1, reserved: 9 }),
      ]);

      const products = await controllerFor(repository).list();

      expect(products[0].stock).toEqual({ available: 1 });
    });

    it('surfaces a repository failure rather than returning an empty list', async () => {
      await expect(controllerFor(new FailingProductRepository()).list()).rejects.toThrow(
        'connection lost',
      );
    });
  });

  describe('byId', () => {
    it('returns the product', async () => {
      const repository = new FakeProductRepository([aStoredProduct({ id: 'p1' })]);

      const product = await controllerFor(repository).byId('p1');

      expect(product.id).toBe('p1');
    });

    it('turns a missing product into a 404 carrying the domain code', async () => {
      const controller = controllerFor(new FakeProductRepository([]));

      await expect(controller.byId('ghost')).rejects.toBeInstanceOf(NotFoundException);

      await controller.byId('ghost').catch((error: NotFoundException) => {
        expect(error.getResponse()).toEqual({
          error: { code: 'PRODUCT_NOT_FOUND', message: 'No product with id ghost' },
        });
      });
    });

    it('does not disguise an infrastructure failure as a missing product', async () => {
      const controller = controllerFor(new FailingProductRepository());

      await expect(controller.byId('p1')).rejects.not.toBeInstanceOf(NotFoundException);
    });
  });
});
