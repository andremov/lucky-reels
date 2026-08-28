import { ApiProperty } from '@nestjs/swagger';
import { TRANSACTION_STATUSES } from '../../domain/transaction';

class AmountsResponse {
  @ApiProperty({ example: 2000000 }) productCents!: number;
  @ApiProperty({ example: 150000 }) baseFeeCents!: number;
  @ApiProperty({ example: 80000 }) deliveryFeeCents!: number;
  @ApiProperty({ example: 2230000 }) totalCents!: number;
  @ApiProperty({ example: 'COP' }) currency!: string;
}

class TransactionProductResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'Starter Pack' }) name!: string;
  @ApiProperty({ example: 20 }) spinsGranted!: number;
}

export class TransactionResponse {
  @ApiProperty({ example: 'LR-7F3A9C2B' })
  reference!: string;

  @ApiProperty({ enum: TRANSACTION_STATUSES, example: 'PENDING' })
  status!: string;

  @ApiProperty({ type: AmountsResponse })
  amounts!: AmountsResponse;

  @ApiProperty({ type: TransactionProductResponse })
  product!: TransactionProductResponse;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ example: '2026-08-28T05:10:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ required: false, example: 20, description: 'Present once APPROVED' })
  creditsGranted?: number;

  @ApiProperty({ required: false, description: 'Present once APPROVED' })
  playerToken?: string;

  @ApiProperty({ required: false, description: 'Present once settled' })
  settledAt?: string;
}
