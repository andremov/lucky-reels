import { err, ok, ResultAsync } from '../../shared/result/result';
import { gameInternalError, unauthorized, type GameError } from '../domain/spin';
import type { GameRepository, SpinRecord } from './game-repository';

export const MAX_HISTORY = 50;

export class ListSpins {
  constructor(private readonly game: GameRepository) {}

  execute(playerToken: string, limit: number): ResultAsync<{ spins: SpinRecord[] }, GameError> {
    const capped = Math.min(Math.max(limit, 1), MAX_HISTORY);

    return ResultAsync.fromPromise(
      this.game.findCustomerByToken(playerToken),
      gameInternalError,
    )
      .andThen((customerId) => (customerId ? ok(customerId) : err(unauthorized())))
      .andThen((customerId) =>
        ResultAsync.fromPromise(
          this.game.recentSpins(customerId, capped),
          gameInternalError,
        ).map((spins) => ({ spins })),
      );
  }
}
