import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PayTransactionDto {
  @ApiProperty({
    example: 'tok_test_visa_4242',
    description:
      'Card token from the provider, created in the browser so the card number never ' +
      'reaches this API. Against the stub gateway the token decides the outcome: ' +
      'tok_ok approves, tok_decline declines, tok_error errors.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  paymentToken!: string;

  @ApiProperty({ required: false, example: 1, minimum: 1, maximum: 36 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  installments?: number;

  @ApiProperty({ required: false, description: 'Gateway terms acceptance token' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  acceptanceToken?: string;
}
