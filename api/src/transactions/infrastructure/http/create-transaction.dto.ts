import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Max,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CustomerDto {
  @ApiProperty({ example: 'someone@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Someone Real' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: '+573001234567' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone!: string;
}

export class DeliveryDto {
  @ApiProperty({ example: 'Calle 1 # 2-3' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  addressLine!: string;

  @ApiProperty({ example: 'Bogota' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  city!: string;

  @ApiProperty({ example: 'Cundinamarca' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  region!: string;

  @ApiProperty({ example: '110111' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  postalCode!: string;
}

export class CreateTransactionDto {
  @ApiProperty({ example: '4f0c9d2e-1a3b-4c5d-8e7f-0a1b2c3d4e5f' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  quantity!: number;

  @ApiProperty({ type: CustomerDto })
  @ValidateNested()
  @Type(() => CustomerDto)
  customer!: CustomerDto;

  @ApiProperty({ type: DeliveryDto })
  @ValidateNested()
  @Type(() => DeliveryDto)
  delivery!: DeliveryDto;
}
