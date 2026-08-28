import type { Result } from '../../shared/result/result';
import type { GameError, SpinOutcome, Symbol } from '../domain/spin';

export type SpinRecord = {
  spinId: string;
  reels: [Symbol, Symbol, Symbol];
  payout: number;
  createdAt: string;
};

export type SpinResult = SpinRecord & { balanceAfter: number };

export interface GameRepository {
  findCustomerByToken(playerToken: string): Promise<string | null>;

  creditsFor(customerId: string): Promise<number>;

  /**
   * Debits the stake, records the spin and credits the payout in one unit of
   * work under a lock on the balance, so two spins fired at once can neither
   * overdraw nor both be paid.
   */
  playSpin(
    customerId: string,
    outcome: SpinOutcome,
  ): Promise<Result<SpinResult, GameError>>;

  recentSpins(customerId: string, limit: number): Promise<SpinRecord[]>;
}
