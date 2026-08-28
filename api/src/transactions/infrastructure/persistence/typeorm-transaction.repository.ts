import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type QueryRunner } from 'typeorm';
import { err, ok, type Result } from '../../../shared/result/result';
import { Stock } from '../../../stock/domain/stock';
import {
  computeAmounts,
  expiryFrom,
  generateReference,
  outOfStock,
  productNotFound,
  type TransactionError,
  type TransactionStatus,
  type TransactionView,
} from '../../domain/transaction';
import type {
  CreateTransactionInput,
  TransactionRepository,
} from '../../application/transaction-repository';

type ProductRow = {
  id: string;
  name: string;
  price_cents: string;
  spins_granted: number;
};

@Injectable()
export class TypeormTransactionRepository implements TransactionRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async createPending(
    input: CreateTransactionInput,
  ): Promise<Result<TransactionView, TransactionError>> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();

    try {
      const outcome = await this.reserveAndInsert(runner, input);

      if (outcome.isErr()) {
        await runner.rollbackTransaction();
        return outcome;
      }

      await runner.commitTransaction();
      return outcome;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  private async reserveAndInsert(
    runner: QueryRunner,
    input: CreateTransactionInput,
  ): Promise<Result<TransactionView, TransactionError>> {
    const products: ProductRow[] = await runner.query(
      'select id, name, price_cents, spins_granted from products where id = $1',
      [input.productId],
    );
    const product = products[0];
    if (!product) return err(productNotFound(input.productId));

    // Locks the row for the life of this transaction. Everything below runs on
    // the same queryRunner, so the lock actually covers the read-modify-write.
    const stockRows: { available: number; reserved: number }[] = await runner.query(
      'select available, reserved from stock where product_id = $1 for update',
      [input.productId],
    );
    const current = stockRows[0] ?? { available: 0, reserved: 0 };

    const reserved = Stock.from({
      productId: input.productId,
      available: current.available,
      reserved: current.reserved,
    }).reserve(input.quantity);

    if (reserved.isErr()) return err(outOfStock(current.available));

    const next = reserved.value;
    await runner.query('update stock set available = $1, reserved = $2 where product_id = $3', [
      next.available,
      next.reserved,
      input.productId,
    ]);

    const customerId = await this.upsertCustomer(runner, input);
    const amounts = computeAmounts(Number(product.price_cents), input.quantity);
    const reference = generateReference();
    const now = new Date();
    const expiresAt = expiryFrom(now);

    const inserted: { id: string }[] = await runner.query(
      `insert into transactions
         (reference, customer_id, product_id, quantity, amount_cents, base_fee_cents,
          delivery_fee_cents, total_cents, status, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', $9)
       returning id`,
      [
        reference,
        customerId,
        input.productId,
        input.quantity,
        amounts.productCents,
        amounts.baseFeeCents,
        amounts.deliveryFeeCents,
        amounts.totalCents,
        expiresAt,
      ],
    );

    await runner.query(
      `insert into deliveries
         (transaction_id, address_line, city, region, postal_code, fee_cents, status)
       values ($1, $2, $3, $4, $5, $6, 'PENDING')`,
      [
        inserted[0].id,
        input.delivery.addressLine,
        input.delivery.city,
        input.delivery.region,
        input.delivery.postalCode,
        amounts.deliveryFeeCents,
      ],
    );

    return ok({
      reference,
      status: 'PENDING' as TransactionStatus,
      amounts,
      quantity: input.quantity,
      product: { id: product.id, name: product.name, spinsGranted: product.spins_granted },
      expiresAt: expiresAt.toISOString(),
    });
  }

  private async upsertCustomer(
    runner: QueryRunner,
    input: CreateTransactionInput,
  ): Promise<string> {
    const rows: { id: string }[] = await runner.query(
      `insert into customers (email, full_name, phone)
       values ($1, $2, $3)
       on conflict (email) do update set full_name = excluded.full_name, phone = excluded.phone
       returning id`,
      [input.customer.email, input.customer.fullName, input.customer.phone],
    );

    return rows[0].id;
  }

  async findByReference(reference: string): Promise<TransactionView | null> {
    const rows: {
      reference: string;
      status: TransactionStatus;
      quantity: number;
      amount_cents: string;
      base_fee_cents: string;
      delivery_fee_cents: string;
      total_cents: string;
      credits_granted: number | null;
      player_token: string | null;
      settled_at: Date | null;
      expires_at: Date;
      product_id: string;
      product_name: string;
      spins_granted: number;
    }[] = await this.dataSource.query(
      `select t.reference, t.status, t.quantity, t.amount_cents, t.base_fee_cents,
              t.delivery_fee_cents, t.total_cents, t.credits_granted, t.player_token,
              t.settled_at, t.expires_at,
              p.id as product_id, p.name as product_name, p.spins_granted
         from transactions t
         join products p on p.id = t.product_id
        where t.reference = $1`,
      [reference],
    );

    const row = rows[0];
    if (!row) return null;

    return {
      reference: row.reference,
      status: row.status,
      quantity: row.quantity,
      amounts: {
        productCents: Number(row.amount_cents),
        baseFeeCents: Number(row.base_fee_cents),
        deliveryFeeCents: Number(row.delivery_fee_cents),
        totalCents: Number(row.total_cents),
        currency: 'COP',
      },
      product: {
        id: row.product_id,
        name: row.product_name,
        spinsGranted: row.spins_granted,
      },
      expiresAt: row.expires_at.toISOString(),
      ...(row.credits_granted !== null ? { creditsGranted: row.credits_granted } : {}),
      ...(row.player_token !== null ? { playerToken: row.player_token } : {}),
      ...(row.settled_at !== null ? { settledAt: row.settled_at.toISOString() } : {}),
    };
  }
}
