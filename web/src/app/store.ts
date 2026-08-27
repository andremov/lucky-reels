import { configureStore } from '@reduxjs/toolkit';
import { gameReducer } from '@/features/game/game-slice';

export const createStore = () =>
  configureStore({
    reducer: {
      game: gameReducer,
    },
  });

export const store = createStore();

export type AppStore = ReturnType<typeof createStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
