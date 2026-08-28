import { ApiProperty } from '@nestjs/swagger';

export class DeliveryResponse {
  @ApiProperty({ example: 'LR-7F3A9C2B' }) reference!: string;
  @ApiProperty({ example: 'Calle 1 # 2-3' }) addressLine!: string;
  @ApiProperty({ example: 'Bogota' }) city!: string;
  @ApiProperty({ example: 'Cundinamarca' }) region!: string;
  @ApiProperty({ example: '110111' }) postalCode!: string;
  @ApiProperty({ example: 80000 }) feeCents!: number;
  @ApiProperty({ example: 'PENDING' }) status!: string;
}
