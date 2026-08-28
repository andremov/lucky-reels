import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithStore } from '@/test/render-with-store';
import { createStore } from '@/app/store';
import { creditsAdded, spinRequested, spinResolved } from './game-slice';
import SlotMachine from './slot-machine';

const SPIN_MS = 2000;

const finishSpin = () => act(() => void jest.advanceTimersByTime(SPIN_MS));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

/**
 * The machine starts empty, so these tests buy credits first — the same way a
 * customer does. Pass credits: 0 to exercise the unfunded state.
 */
const setup = ({ credits = 20, store = createStore() } = {}) => {
  if (credits > 0) store.dispatch(creditsAdded(credits));
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  return { user, ...renderWithStore(<SlotMachine />, store) };
};

it('shows the current balance', () => {
  const { store } = setup();

  expect(screen.getByText(String(store.getState().game.credits))).toBeInTheDocument();
});

it('offers no spin until the machine has been funded', () => {
  setup({ credits: 0 });

  const button = screen.getByRole('button');
  expect(button).toBeDisabled();
  expect(button).toHaveTextContent(/out of credits/i);
});

it('charges a credit and locks the button while the reels run', async () => {
  const { user, store } = setup();
  const before = store.getState().game.credits;

  await user.click(screen.getByRole('button'));

  expect(store.getState().game.credits).toBe(before - 1);
  expect(screen.getByRole('button')).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent(/spinning/i);
});

it('settles the spin once the reels stop', async () => {
  const { user, store } = setup();

  await user.click(screen.getByRole('button'));
  finishSpin();

  expect(store.getState().game.status).toBe('idle');
  expect(store.getState().game.lastPayout).not.toBeNull();
  expect(screen.getByRole('button')).toBeEnabled();
});

it('announces the outcome', async () => {
  const { user, store } = setup();

  await user.click(screen.getByRole('button'));
  finishSpin();

  const payout = store.getState().game.lastPayout;
  const expected = payout && payout > 0 ? new RegExp(`won ${payout}`, 'i') : /no win/i;

  expect(screen.getByRole('status')).toHaveTextContent(expected);
});

it('stops the player once the credits run out', async () => {
  const store = createStore();
  store.dispatch(creditsAdded(1));
  // Spend the single credit on a losing spin, deterministically, so the
  // machine is genuinely empty rather than dependent on a random outcome.
  store.dispatch(spinRequested());
  store.dispatch(spinResolved({ reels: ['cherry', 'lemon', 'bell'], payout: 0 }));
  expect(store.getState().game.credits).toBe(0);

  const { user } = setup({ credits: 0, store });
  const button = screen.getByRole('button');

  expect(button).toBeDisabled();
  expect(button).toHaveTextContent(/out of credits/i);

  await user.click(button);
  expect(store.getState().game.status).toBe('idle');
});
