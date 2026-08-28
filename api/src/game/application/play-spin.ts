import { err, ok, ResultAsync } from '../../shared/result/result';
import { gameInternalError, resolveSpin, unauthorized, type GameError } from '../domain/spin';
import type { GameRepository, SpinResult } from './game-repository';

export class PlaySpin {
  constructor(
    private readonly game: GameRepository,
    private readonly rng: () => number = Math.random,
  ) {}

  execute(playerToken: string): ResultAsync<SpinResult, GameError> {
    return ResultAsync.fromPromise(
      this.game.findCustomerByToken(playerToken),
      gameInternalError,
    )
      .andThen((customerId) => (customerId ? ok(customerId) : err(unauthorized())))
      .andThen((customerId) =>
        ResultAsync.fromPromise(
          this.game.playSpin(customerId, resolveSpin(this.rng)),
          gameInternalError,
        ).andThen((result) => result),
      );
  }
}
