import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GetProduct } from './application/get-product';
import { ListProducts } from './application/list-products';
import type { ProductRepository } from './application/product-repository';
import { ProductsController } from './infrastructure/http/products.controller';
import { ProductEntity } from './infrastructure/persistence/product.entity';
import { StockEntity } from './infrastructure/persistence/stock.entity';
import { TypeormProductRepository } from './infrastructure/persistence/typeorm-product.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity, StockEntity])],
  controllers: [ProductsController],
  providers: [
    TypeormProductRepository,
    {
      provide: ListProducts,
      inject: [TypeormProductRepository],
      useFactory: (repository: ProductRepository) => new ListProducts(repository),
    },
    {
      provide: GetProduct,
      inject: [TypeormProductRepository],
      useFactory: (repository: ProductRepository) => new GetProduct(repository),
    },
  ],
  exports: [TypeormProductRepository],
})
export class ProductsModule {}
