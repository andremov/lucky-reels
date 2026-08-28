import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'stock' })
export class StockEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @Column({ type: 'int', default: 0 })
  available!: number;

  @Column({ type: 'int', default: 0 })
  reserved!: number;
}
