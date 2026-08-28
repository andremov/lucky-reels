import { Module } from '@nestjs/common';
import { GetBalance } from './application/get-balance';
import { ListSpins } from './application/list-spins';
import { PlaySpin } from './application/play-spin';
import type { GameRepository } from './application/game-repository';
import { GameController } from './infrastructure/http/game.controller';
import { TypeormGameRepository } from './infrastructure/persistence/typeorm-game.repository';

@Module({
  controllers: [GameController],
  providers: [
    TypeormGameRepository,
    {
      provide: GetBalance,
      inject: [TypeormGameRepository],
      useFactory: (repository: GameRepository) => new GetBalance(repository),
    },
    {
      provide: PlaySpin,
      inject: [TypeormGameRepository],
      useFactory: (repository: GameRepository) => new PlaySpin(repository),
    },
    {
      provide: ListSpins,
      inject: [TypeormGameRepository],
      useFactory: (repository: GameRepository) => new ListSpins(repository),
    },
  ],
})
export class GameModule {}
