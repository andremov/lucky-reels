import { err, ok, type Result } from '../../shared/result/result';
import { insufficientCredits, type GameError, type SpinOutcome } from '../domain/spin';
import type { GameRepository, SpinRecord, SpinResult } from './game-repository';
import { GetBalance } from './get-balance';
import { ListSpins } from './list-spins';
import { MAX_HISTORY } from './list-spins';
import { PlaySpin } from './play-spin';

const TOKEN = 'plr_known';

class FakeGameRepository implements GameRepository {
  readonly played: SpinOutcome[] = [];
  lastLimit = 0;

  constructor(
    private readonly credits = 10,
    private readonly outcome: Result<SpinResult, GameError> | null = null,
    private readonly history: SpinRecord[] = [],
  ) {}

  findCustomerByToken(playerToken: string): Promise<string | null> {
    return Promise.resolve(playerToken === TOKEN ? 'c1' : null);
  }

  creditsFor(): Promise<number> {
    return Promise.resolve(this.credits);
  }

  playSpin(_customerId: string, outcome: SpinOutcome): Promise<Result<SpinResult, GameError>> {
    this.played.push(outcome);

    return Promise.resolve(
      this.outcome ??
        ok({
          spinId: 's1',
          reels: outcome.reels,
          payout: outcome.payout,
          balanceAfter: this.credits - 1 + outcome.payout,
          createdAt: '2026-08-28T00:00:00.000Z',
        }),
    );
  }

  recentSpins(_customerId: string, limit: number): Promise<SpinRecord[]> {
    this.lastLimit = limit;
    return Promise.resolve(this.history);
  }
}

describe('GetBalance', () => {
  it('returns the credits for a known token', async () => {
    const result = await new GetBalance(new FakeGameRepository(7)).execute(TOKEN);

    expect(result.match({ ok: (b) => b.credits, err: () => -1 })).toBe(7);
  });

  it('rejects an unknown token', async () => {
    const result = await new GetBalance(new FakeGameRepository()).execute('plr_forged');

    expect(result.match({ ok: () => 'ok', err: (e) => e.code })).toBe('UNAUTHORIZED');
  });

  it('rejects an absent token', async () => {
    const result = await new GetBalance(new FakeGameRepository()).execute('');

    expect(result.match({ ok: () => 'ok', err: (e) => e.code })).toBe('UNAUTHORIZED');
  });
});

describe('PlaySpin', () => {
  it('resolves the outcome server side and hands it to the repository', async () => {
    const repository = new FakeGameRepository(10);

    await new PlaySpin(repository, () => 0).execute(TOKEN);

    expect(repository.played).toHaveLength(1);
    expect(repository.played[0].reels).toEqual(['cherry', 'cherry', 'cherry']);
  });

  it('returns the balance after the stake and the payout', async () => {
    const repository = new FakeGameRepository(10);

    const result = await new PlaySpin(repository, () => 0).execute(TOKEN);

    // three cherries pays 10, minus the 1 credit stake
    expect(result.match({ ok: (s) => s.balanceAfter, err: () => -1 })).toBe(19);
  });

  it('refuses an unknown token before spinning anything', async () => {
    const repository = new FakeGameRepository();

    const result = await new PlaySpin(repository).execute('plr_forged');

    expect(result.match({ ok: () => 'ok', err: (e) => e.code })).toBe('UNAUTHORIZED');
    expect(repository.played).toHaveLength(0);
  });

  it('surfaces an empty balance as INSUFFICIENT_CREDITS', async () => {
    const repository = new FakeGameRepository(0, err(insufficientCredits(0)));

    const result = await new PlaySpin(repository).execute(TOKEN);

    expect(result.match({ ok: () => 'ok', err: (e) => e.code })).toBe('INSUFFICIENT_CREDITS');
  });
});

describe('ListSpins', () => {
  const history: SpinRecord[] = [
    { spinId: 's1', reels: ['bell', 'bell', 'star'], payout: 2, createdAt: '2026-08-28T00:00:00.000Z' },
  ];

  it('returns the history for a known token', async () => {
    const result = await new ListSpins(new FakeGameRepository(5, null, history)).execute(TOKEN, 20);

    expect(result.match({ ok: (s) => s.spins, err: () => [] })).toEqual(history);
  });

  it('caps an outlandish limit rather than reading the whole table', async () => {
    const repository = new FakeGameRepository(5, null, history);

    await new ListSpins(repository).execute(TOKEN, 100_000);

    expect(repository.lastLimit).toBe(MAX_HISTORY);
  });

  it('raises a nonsensical limit to at least one', async () => {
    const repository = new FakeGameRepository(5, null, history);

    await new ListSpins(repository).execute(TOKEN, 0);

    expect(repository.lastLimit).toBe(1);
  });

  it('rejects an unknown token', async () => {
    const result = await new ListSpins(new FakeGameRepository()).execute('plr_forged', 20);

    expect(result.match({ ok: () => 'ok', err: (e) => e.code })).toBe('UNAUTHORIZED');
  });
});
