import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { resolveSpin, SPIN_COST, type Spin, type Symbol } from './spin';

// TODO: credits should come from a completed checkout once that exists.
export const DEV_STARTING_CREDITS = 20;

export type GameState = {
  credits: number;
  reels: [Symbol, Symbol, Symbol];
  status: 'idle' | 'spinning';
  lastPayout: number | null;
  spinCount: number;
};

const initialState: GameState = {
  credits: DEV_STARTING_CREDITS,
  reels: ['cherry', 'lemon', 'bell'],
  status: 'idle',
  lastPayout: null,
  spinCount: 0,
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    spinRequested(state) {
      if (state.status === 'spinning') return;
      if (state.credits < SPIN_COST) return;

      state.credits -= SPIN_COST;
      state.status = 'spinning';
      state.lastPayout = null;
      state.spinCount += 1;
    },

    spinResolved(state, action: PayloadAction<Spin>) {
      if (state.status !== 'spinning') return;

      state.reels = action.payload.reels;
      state.credits += action.payload.payout;
      state.lastPayout = action.payload.payout;
      state.status = 'idle';
    },

    creditsAdded(state, action: PayloadAction<number>) {
      state.credits += action.payload;
    },
  },
});

export const { spinRequested, spinResolved, creditsAdded } = gameSlice.actions;
export const gameReducer = gameSlice.reducer;
export { resolveSpin };
