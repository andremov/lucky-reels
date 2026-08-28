import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ProductRepository, StoredProduct } from '../../application/product-repository';
import { ProductEntity } from './product.entity';
import { StockEntity } from './stock.entity';

@Injectable()
export class TypeormProductRepository implements ProductRepository {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    @InjectRepository(StockEntity)
    private readonly stock: Repository<StockEntity>,
  ) {}

  async findAll(): Promise<StoredProduct[]> {
    const rows = await this.products.find({ order: { spinsGranted: 'ASC' } });
    const stock = await this.stock.find();
    const byProduct = new Map(stock.map((s) => [s.productId, s]));

    return rows.map((row) => toStoredProduct(row, byProduct.get(row.id)));
  }

  async findById(id: string): Promise<StoredProduct | null> {
    const row = await this.products.findOne({ where: { id } });
    if (!row) return null;

    const stock = await this.stock.findOne({ where: { productId: id } });

    return toStoredProduct(row, stock);
  }
}

export function toStoredProduct(
  row: ProductEntity,
  stock: StockEntity | null | undefined,
): StoredProduct {
  return {
    product: {
      id: row.id,
      name: row.name,
      description: row.description,
      // bigint arrives as a string so large amounts survive the round trip.
      priceCents: Number(row.priceCents),
      currency: 'COP',
      imageUrl: row.imageUrl,
      spinsGranted: row.spinsGranted,
    },
    stock: {
      productId: row.id,
      available: stock?.available ?? 0,
      reserved: stock?.reserved ?? 0,
    },
  };
}
