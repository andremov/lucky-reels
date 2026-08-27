import {
  creditsAdded,
  DEV_STARTING_CREDITS,
  gameReducer,
  spinRequested,
  spinResolved,
  type GameState,
} from './game-slice';

const initial = (): GameState => gameReducer(undefined, { type: '@@init' });

const spinning = (overrides: Partial<GameState> = {}): GameState => ({
  ...gameReducer(initial(), spinRequested()),
  ...overrides,
});

describe('spinRequested', () => {
  it('takes the stake and marks the machine busy', () => {
    const state = gameReducer(initial(), spinRequested());

    expect(state.credits).toBe(DEV_STARTING_CREDITS - 1);
    expect(state.status).toBe('spinning');
    expect(state.spinCount).toBe(1);
  });

  it('clears the previous result so it cannot be read as the new one', () => {
    const after = gameReducer({ ...initial(), lastPayout: 25 }, spinRequested());

    expect(after.lastPayout).toBeNull();
  });

  it('ignores a second request while a spin is running', () => {
    const state = gameReducer(spinning(), spinRequested());

    expect(state.credits).toBe(DEV_STARTING_CREDITS - 1);
    expect(state.spinCount).toBe(1);
  });

  it('refuses to spin without the credits to cover it', () => {
    const broke = { ...initial(), credits: 0 };
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
    expect(state.credits).toBe(DEV_STARTING_CREDITS - 1 + 100);
    expect(state.lastPayout).toBe(100);
    expect(state.status).toBe('idle');
  });

  it('records a loss as zero rather than nothing', () => {
    const state = gameReducer(
      spinning(),
      spinResolved({ reels: ['cherry', 'lemon', 'bell'], payout: 0 }),
    );

    expect(state.lastPayout).toBe(0);
    expect(state.credits).toBe(DEV_STARTING_CREDITS - 1);
  });

  it('ignores a result that arrives when no spin is running', () => {
    const state = gameReducer(
      initial(),
      spinResolved({ reels: ['diamond', 'diamond', 'diamond'], payout: 100 }),
    );

    expect(state.credits).toBe(DEV_STARTING_CREDITS);
    expect(state.lastPayout).toBeNull();
  });
});

describe('creditsAdded', () => {
  it('tops up the balance', () => {
    const state = gameReducer(initial(), creditsAdded(50));

    expect(state.credits).toBe(DEV_STARTING_CREDITS + 50);
  });
});
