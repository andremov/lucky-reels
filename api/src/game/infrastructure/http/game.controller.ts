import {
  Controller,
  Get,
  Headers,
  HttpCode,
  InternalServerErrorException,
  ParseIntPipe,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetBalance } from '../../application/get-balance';
import { ListSpins } from '../../application/list-spins';
import { PlaySpin } from '../../application/play-spin';
import type { SpinRecord, SpinResult } from '../../application/game-repository';
import type { GameError } from '../../domain/spin';
import { BalanceResponse, SpinHistoryResponse, SpinResultResponse } from './game.response';

@ApiTags('Game')
@ApiBearerAuth()
@Controller()
export class GameController {
  constructor(
    private readonly getBalance: GetBalance,
    private readonly playSpin: PlaySpin,
    private readonly listSpins: ListSpins,
  ) {}

  @Get('balances/me')
  @ApiOperation({
    summary: 'Credits available to this player',
    description:
      'Requires the playerToken issued when a purchase was approved, as a bearer token. ' +
      'Credits are the currency of the machine: one buys one spin.',
  })
  @ApiOkResponse({ type: BalanceResponse })
  async balance(@Headers('authorization') authorization?: string): Promise<{ credits: number }> {
    const result = await this.getBalance.execute(bearer(authorization));

    return result.match({ ok: (b) => b, err: toHttpError });
  }

  @Post('spins')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Spin the reels',
    description:
      'Debits one credit and returns the outcome the server decided. The client cannot ' +
      'influence the result; what it renders is an animation of this response.',
  })
  @ApiOkResponse({ type: SpinResultResponse })
  async spin(@Headers('authorization') authorization?: string): Promise<SpinResult> {
    const result = await this.playSpin.execute(bearer(authorization));

    return result.match({ ok: (s) => s, err: toHttpError });
  }

  @Get('spins')
  @ApiOperation({
    summary: 'Recent spins for this player',
    description:
      'Newest first. limit defaults to 20 and is capped at 50, so a large value cannot read ' +
      'the whole table.',
  })
  @ApiOkResponse({ type: SpinHistoryResponse })
  async history(
    @Headers('authorization') authorization?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ): Promise<{ spins: SpinRecord[] }> {
    const result = await this.listSpins.execute(bearer(authorization), limit);

    return result.match({ ok: (s) => s, err: toHttpError });
  }
}

const bearer = (authorization?: string): string =>
  authorization?.replace(/^Bearer\s+/i, '').trim() ?? '';

export function toHttpError(error: GameError): never {
  const body = { error: { code: error.code, message: error.message } };

  switch (error.code) {
    case 'UNAUTHORIZED':
      throw new UnauthorizedException(body);
    case 'INSUFFICIENT_CREDITS':
      throw new HttpException(body, HttpStatus.PAYMENT_REQUIRED);
    default:
      throw new InternalServerErrorException(body);
  }
}
