import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore } from '@/app/store';
import { renderWithStore } from '@/test/render-with-store';
import { createMockCheckoutClient } from './checkout-client.mock';
import {
  createTransaction,
  customerChanged,
  deliveryChanged,
  loadProducts,
  productSelected,
  stepChanged,
} from './checkout-slice';
import { TokenizationError, type CardTokenizer } from './card-tokenizer';
import { TokenizerProvider } from './tokenizer-context';
import StepPayment from './step-payment';

const CUSTOMER = { email: 'a@b.co', fullName: 'Someone Real', phone: '+573001234567' };
const DELIVERY = {
  addressLine: 'Calle 1 # 2-3',
  city: 'Bogota',
  region: 'Cundinamarca',
  postalCode: '110111',
};

/** A store already holding a reserved transaction, as the payment step expects. */
async function setup(tokenizer: CardTokenizer) {
  const store = createStore(createMockCheckoutClient());
  await store.dispatch(loadProducts());
  store.dispatch(productSelected({ productId: 'prd_starter' }));
  store.dispatch(customerChanged(CUSTOMER));
  store.dispatch(deliveryChanged(DELIVERY));
  await store.dispatch(createTransaction());
  store.dispatch(stepChanged('payment'));

  const user = userEvent.setup();
  const rendered = renderWithStore(
    <TokenizerProvider tokenizer={tokenizer}>
      <StepPayment />
    </TokenizerProvider>,
    store,
  );
  return { user, ...rendered, store };
}

async function fillCard(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /pay with credit card/i }));
  await screen.findByRole('dialog');
  await user.type(screen.getByLabelText(/card number/i), '4242424242424242');
  await user.type(screen.getByLabelText(/name on card/i), 'Someone Real');
  await user.type(screen.getByLabelText(/expiry/i), '12/30');
  await user.type(screen.getByLabelText(/cvv/i), '123');
  await user.click(screen.getByRole('button', { name: /^pay now$/i }));
}

const failWith = (error: unknown): CardTokenizer => ({
  mode: 'live',
  tokenize: () => Promise.reject(error),
});

describe('payment step tokenization failures', () => {
  it('puts a rejected card number on the card-number field, keeping the modal open', async () => {
    const { user, store } = await setup(
      failWith(
        new TokenizationError('rejected', {
          cardNumber: 'El número de tarjeta usado no es aceptado en el ambiente de pruebas.',
        }),
      ),
    );
    await fillCard(user);

    const input = await screen.findByLabelText(/card number/i);
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription(/no es aceptado/);
    // Still open, so the customer can correct it rather than starting over.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Nothing was sent to the API.
    expect(store.getState().checkout.status).toBe('PENDING');
  });

  it('spreads provider field errors across the inputs they belong to', async () => {
    const { user } = await setup(
      failWith(
        new TokenizationError('rejected', {
          cvv: 'invalid security code',
          expiry: 'card has expired',
        }),
      ),
    );
    await fillCard(user);

    expect(await screen.findByText('invalid security code')).toBeInTheDocument();
    expect(screen.getByText('card has expired')).toBeInTheDocument();
  });

  it('falls back to the card-number field when the provider blames nothing specific', async () => {
    const { user } = await setup(
      failWith(new TokenizationError('Could not reach the payment provider.')),
    );
    await fillCard(user);

    expect(await screen.findByText(/could not reach the payment provider/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('survives an error that is not a TokenizationError at all', async () => {
    const { user } = await setup(failWith(new Error('boom')));
    await fillCard(user);

    expect(await screen.findByText(/could not verify these card details/i)).toBeInTheDocument();
  });

  it('sends the token and closes the modal when tokenization succeeds', async () => {
    const tokenizer: CardTokenizer = {
      mode: 'live',
      tokenize: async () => 'tok_stagtest_5113_B2Ff12B86b499b9361e2C14f0aD2b2a2',
    };
    const { user, store } = await setup(tokenizer);
    await fillCard(user);

    // Payment was attempted, so the flow moved off the card form.
    expect(await screen.findByText(/reference/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(store.getState().checkout.step).toBe('result');
  });
});
