import { err, ok, ResultAsync } from '../../shared/result/result';
import { gameInternalError, unauthorized, type GameError } from '../domain/spin';
import type { GameRepository } from './game-repository';

export class GetBalance {
  constructor(private readonly game: GameRepository) {}

  execute(playerToken: string): ResultAsync<{ credits: number }, GameError> {
    return ResultAsync.fromPromise(
      this.game.findCustomerByToken(playerToken),
      gameInternalError,
    )
      .andThen((customerId) => (customerId ? ok(customerId) : err(unauthorized())))
      .andThen((customerId) =>
        ResultAsync.fromPromise(this.game.creditsFor(customerId), gameInternalError).map(
          (credits) => ({ credits }),
        ),
      );
  }
}
