import { ApiProperty } from '@nestjs/swagger';
import { SYMBOLS } from '../../domain/spin';

export class BalanceResponse {
  @ApiProperty({ example: 18 })
  credits!: number;
}

export class SpinResultResponse {
  @ApiProperty({ example: 'a3f1c8de-0b21-4a77-9a2e-6c1f0b9d7e42' })
  spinId!: string;

  @ApiProperty({ example: ['cherry', 'cherry', 'diamond'], enum: SYMBOLS, isArray: true })
  reels!: string[];

  @ApiProperty({ example: 2, description: 'Credits won. Only the middle row pays.' })
  payout!: number;

  @ApiProperty({ example: 19 })
  balanceAfter!: number;

  @ApiProperty({ example: '2026-08-28T05:40:00.000Z' })
  createdAt!: string;
}

export class SpinHistoryResponse {
  @ApiProperty({ type: [SpinResultResponse] })
  spins!: SpinResultResponse[];
}
