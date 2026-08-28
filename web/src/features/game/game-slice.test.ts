import {
  creditsAdded,
  gameReducer,
  spinRequested,
  spinResolved,
  type GameState,
} from './game-slice';

const initial = (): GameState => gameReducer(undefined, { type: '@@init' });

/** Credits only ever arrive from a completed purchase, so tests buy first. */
const FUNDED = 20;
const funded = (): GameState => gameReducer(initial(), creditsAdded(FUNDED));

const spinning = (overrides: Partial<GameState> = {}): GameState => ({
  ...gameReducer(funded(), spinRequested()),
  ...overrides,
});

describe('a new machine', () => {
  it('starts empty, because spins are bought and not given', () => {
    expect(initial().credits).toBe(0);
  });

  it('cannot be played until it is funded', () => {
    const state = gameReducer(initial(), spinRequested());

    expect(state.credits).toBe(0);
    expect(state.status).toBe('idle');
    expect(state.spinCount).toBe(0);
  });
});

describe('spinRequested', () => {
  it('takes the stake and marks the machine busy', () => {
    const state = gameReducer(funded(), spinRequested());

    expect(state.credits).toBe(FUNDED - 1);
    expect(state.status).toBe('spinning');
    expect(state.spinCount).toBe(1);
  });

  it('clears the previous result so it cannot be read as the new one', () => {
    const after = gameReducer({ ...funded(), lastPayout: 25 }, spinRequested());

    expect(after.lastPayout).toBeNull();
  });

  it('ignores a second request while a spin is running', () => {
    const state = gameReducer(spinning(), spinRequested());

    expect(state.credits).toBe(FUNDED - 1);
    expect(state.spinCount).toBe(1);
  });

  it('refuses to spin without the credits to cover it', () => {
    const broke = { ...funded(), credits: 0 };
    const state = gameReducer(broke, spinRequested());

    expect(state.credits).toBe(0);
    expect(state.status).toBe('idle');
  });
});

describe('spinResolved', () => {
  it('shows the reels and pays the win', () => {
    const state = gameReducer(
      spinning(),
      spinResolved({ reels: ['diamond', 'diamond', 'diamond'], payout: 100 }),
    );

    expect(state.reels).toEqual(['diamond', 'diamond', 'diamond']);
    expect(state.credits).toBe(FUNDED - 1 + 100);
    expect(state.lastPayout).toBe(100);
    expect(state.status).toBe('idle');
  });

  it('records a loss as zero rather than nothing', () => {
    const state = gameReducer(
      spinning(),
      spinResolved({ reels: ['cherry', 'lemon', 'bell'], payout: 0 }),
    );

    expect(state.lastPayout).toBe(0);
    expect(state.credits).toBe(FUNDED - 1);
  });

  it('ignores a result that arrives when no spin is running', () => {
    const state = gameReducer(
      funded(),
      spinResolved({ reels: ['diamond', 'diamond', 'diamond'], payout: 100 }),
    );

    expect(state.credits).toBe(FUNDED);
    expect(state.lastPayout).toBeNull();
  });
});

describe('creditsAdded', () => {
  it('tops up the balance', () => {
    const state = gameReducer(initial(), creditsAdded(50));

    expect(state.credits).toBe(50);
  });

  it('adds to an existing balance rather than replacing it', () => {
    const state = gameReducer(funded(), creditsAdded(50));

    expect(state.credits).toBe(FUNDED + 50);
  });
});
