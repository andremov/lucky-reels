import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'products' })
export class ProductEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'price_cents', type: 'bigint' })
  priceCents!: string;

  @Column({ type: 'text', default: 'COP' })
  currency!: string;

  @Column({ name: 'image_url', type: 'text' })
  imageUrl!: string;

  @Column({ name: 'spins_granted', type: 'int' })
  spinsGranted!: number;
}
