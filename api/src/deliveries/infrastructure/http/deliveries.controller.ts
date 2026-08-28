import { Controller, Get, InternalServerErrorException, NotFoundException, Param } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DeliveryResponse } from './delivery.response';

type DeliveryRow = {
  reference: string;
  address_line: string;
  city: string;
  region: string;
  postal_code: string;
  fee_cents: string;
  status: string;
};

@ApiTags('Deliveries')
@Controller('deliveries')
export class DeliveriesController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get(':reference')
  @ApiOperation({
    summary: 'Delivery for a transaction',
    description:
      'Exists from the moment the transaction is created. status is PENDING while the ' +
      'transaction is pending and becomes ASSIGNED once the payment is approved. ' +
      'Returns 404 DELIVERY_NOT_FOUND only when the reference is unknown.',
  })
  @ApiOkResponse({ type: DeliveryResponse })
  async byReference(@Param('reference') reference: string): Promise<DeliveryResponse> {
    const rows = await this.read(reference);
    const row = rows[0];

    if (!row) {
      throw new NotFoundException({
        error: {
          code: 'DELIVERY_NOT_FOUND',
          message: `No delivery for transaction ${reference}`,
        },
      });
    }

    return {
      reference: row.reference,
      addressLine: row.address_line,
      city: row.city,
      region: row.region,
      postalCode: row.postal_code,
      feeCents: Number(row.fee_cents),
      status: row.status,
    };
  }

  private async read(reference: string): Promise<DeliveryRow[]> {
    try {
      return (await this.dataSource.query(
        `select t.reference, d.address_line, d.city, d.region, d.postal_code,
                d.fee_cents, d.status
           from deliveries d
           join transactions t on t.id = d.transaction_id
          where t.reference = $1`,
        [reference],
      )) as DeliveryRow[];
    } catch (error) {
      throw new InternalServerErrorException({
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unexpected failure',
        },
      });
    }
  }
}
