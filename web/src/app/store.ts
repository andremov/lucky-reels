import { configureStore } from '@reduxjs/toolkit';
import { gameReducer } from '@/features/game/game-slice';
import { checkoutReducer, type ThunkExtra } from '@/features/checkout/checkout-slice';
import type { CheckoutClient } from '@/features/checkout/checkout-client';
import { createMockCheckoutClient } from '@/features/checkout/checkout-client.mock';

/**
 * Kept free of `import.meta` so tests can import it under ts-jest's CommonJS
 * transform. The entry point decides which client the real app gets.
 */
export const createStore = (client: CheckoutClient = createMockCheckoutClient()) =>
  configureStore({
    reducer: {
      game: gameReducer,
      checkout: checkoutReducer,
    },
    middleware: (getDefault) =>
      getDefault({ thunk: { extraArgument: { client } satisfies ThunkExtra } }),
  });

export type AppStore = ReturnType<typeof createStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
