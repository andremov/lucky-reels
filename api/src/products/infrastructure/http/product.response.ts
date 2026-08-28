import { ApiProperty } from '@nestjs/swagger';

class StockResponse {
  @ApiProperty({ example: 7, description: 'Units a buyer can take right now' })
  available!: number;
}

export class ProductResponse {
  @ApiProperty({ example: '4f0c9d2e-1a3b-4c5d-8e7f-0a1b2c3d4e5f' })
  id!: string;

  @ApiProperty({ example: 'Starter Pack' })
  name!: string;

  @ApiProperty({ example: '20 spins on the Lucky Reels machine' })
  description!: string;

  @ApiProperty({ example: 2000000, description: 'Integer cents, never a float' })
  priceCents!: number;

  @ApiProperty({ example: 'COP' })
  currency!: string;

  @ApiProperty({ example: 'https://example.test/starter.png' })
  imageUrl!: string;

  @ApiProperty({ example: 20, description: 'Credits granted once the payment settles' })
  spinsGranted!: number;

  @ApiProperty({ type: StockResponse })
  stock!: StockResponse;
}
