import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type QueryRunner } from 'typeorm';
import { err, ok, type Result } from '../../../shared/result/result';
import {
  insufficientCredits,
  SPIN_COST,
  type GameError,
  type SpinOutcome,
  type Symbol,
} from '../../domain/spin';
import type { GameRepository, SpinRecord, SpinResult } from '../../application/game-repository';

type SpinRow = {
  id: string;
  reels: string;
  payout_credits: number;
  created_at: Date;
};

@Injectable()
export class TypeormGameRepository implements GameRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findCustomerByToken(playerToken: string): Promise<string | null> {
    const rows: { customer_id: string }[] = await this.dataSource.query(
      'select customer_id from transactions where player_token = $1 limit 1',
      [playerToken],
    );

    return rows[0]?.customer_id ?? null;
  }

  async creditsFor(customerId: string): Promise<number> {
    const rows: { credits: number }[] = await this.dataSource.query(
      'select credits from balances where customer_id = $1',
      [customerId],
    );

    return rows[0]?.credits ?? 0;
  }

  async playSpin(customerId: string, outcome: SpinOutcome): Promise<Result<SpinResult, GameError>> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();

    try {
      const played = await this.debitAndRecord(runner, customerId, outcome);

      if (played.isErr()) {
        await runner.rollbackTransaction();
        return played;
      }

      await runner.commitTransaction();
      return played;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  private async debitAndRecord(
    runner: QueryRunner,
    customerId: string,
    outcome: SpinOutcome,
  ): Promise<Result<SpinResult, GameError>> {
    const rows: { credits: number }[] = await runner.query(
      'select credits from balances where customer_id = $1 for update',
      [customerId],
    );

    const credits = rows[0]?.credits ?? 0;
    if (credits < SPIN_COST) return err(insufficientCredits(credits));

    const balanceAfter = credits - SPIN_COST + outcome.payout;

    await runner.query(
      'update balances set credits = $1, updated_at = now() where customer_id = $2',
      [balanceAfter, customerId],
    );

    const inserted: { id: string; created_at: Date }[] = await runner.query(
      `insert into spins (customer_id, reels, payout_credits, balance_after)
       values ($1, $2, $3, $4)
       returning id, created_at`,
      [customerId, JSON.stringify(outcome.reels), outcome.payout, balanceAfter],
    );

    return ok({
      spinId: inserted[0].id,
      reels: outcome.reels,
      payout: outcome.payout,
      balanceAfter,
      createdAt: inserted[0].created_at.toISOString(),
    });
  }

  async recentSpins(customerId: string, limit: number): Promise<SpinRecord[]> {
    const rows: SpinRow[] = await this.dataSource.query(
      `select id, reels, payout_credits, created_at
         from spins
        where customer_id = $1
        order by created_at desc
        limit $2`,
      [customerId, limit],
    );

    return rows.map((row) => ({
      spinId: row.id,
      reels: JSON.parse(row.reels) as [Symbol, Symbol, Symbol],
      payout: row.payout_credits,
      createdAt: row.created_at.toISOString(),
    }));
  }
}
