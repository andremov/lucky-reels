import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore } from '@/app/store';
import { renderWithStore } from '@/test/render-with-store';
import { createMockCheckoutClient } from './checkout-client.mock';
import type { CheckoutClient } from './checkout-client';
import { clearCheckout, saveCheckout } from './checkout-storage';
import CheckoutWizard from './checkout-wizard';
import { ApiError } from './checkout-types';

function setup(client: CheckoutClient = createMockCheckoutClient()) {
  const store = createStore(client);
  const user = userEvent.setup();
  return { user, client, ...renderWithStore(<CheckoutWizard />, store) };
}

const CUSTOMER = {
  'Full name': 'Someone Real',
  Email: 'someone@example.com',
  Phone: '+573001234567',
};
const ADDRESS = {
  Address: 'Calle 1 # 2-3',
  City: 'Bogota',
  Region: 'Cundinamarca',
  'Postal code': '110111',
};
const CARD = {
  'Name on card': 'Someone Real',
  'Expiry (MM/YY)': '12/30',
  CVV: '987',
};

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function fill(user: ReturnType<typeof userEvent.setup>, fields: Record<string, string>) {
  for (const [label, value] of Object.entries(fields)) {
    await user.type(screen.getByLabelText(new RegExp(escape(label), 'i')), value);
  }
}

/** Product step -> details -> summary. */
async function chooseStarterPack(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('button', { name: /starter pack/i });
  await user.click(screen.getByRole('button', { name: /starter pack/i }));
  await user.click(screen.getByRole('button', { name: /continue/i }));

  await fill(user, CUSTOMER);
  await fill(user, ADDRESS);
  await user.click(screen.getByRole('button', { name: /review order/i }));
}

async function payWithCard(user: ReturnType<typeof userEvent.setup>, number = '4242424242424242') {
  await user.type(screen.getByLabelText(/card number/i), number);
  await fill(user, CARD);
  await user.click(screen.getByRole('button', { name: /^pay/i }));
}

beforeEach(() => {
  clearCheckout();
  window.localStorage.clear();
});

describe('checkout wizard', () => {
  it('starts on the pack step and loads products', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: /pick a pack/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /starter pack/i })).toBeInTheDocument();
  });

  it('will not advance until a pack is chosen', async () => {
    setup();
    await screen.findByRole('button', { name: /starter pack/i });
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('shows stock as the API reports it', async () => {
    setup();
    const pack = await screen.findByRole('button', { name: /starter pack/i });
    expect(within(pack).getByText(/7 available/i)).toBeInTheDocument();
  });

  it('blocks a sold-out pack', async () => {
    const client = createMockCheckoutClient({
      products: [
        {
          id: 'prd_gone',
          name: 'Gone Pack',
          description: 'nothing left',
          priceCents: 100,
          currency: 'COP',
          imageUrl: '',
          spinsGranted: 1,
          stock: { available: 0 },
        },
      ],
    });
    setup(client);
    const pack = await screen.findByRole('button', { name: /gone pack/i });
    expect(pack).toBeDisabled();
    expect(within(pack).getByText(/sold out/i)).toBeInTheDocument();
  });

  it('refuses to leave the details step while fields are missing', async () => {
    const { user } = setup();
    await screen.findByRole('button', { name: /starter pack/i });
    await user.click(screen.getByRole('button', { name: /starter pack/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await user.click(screen.getByRole('button', { name: /review order/i }));

    expect(screen.getByRole('heading', { name: /where should it go/i })).toBeInTheDocument();
    expect(await screen.findByText(/enter your full name/i)).toBeInTheDocument();
    expect(screen.getByText(/enter your email/i)).toBeInTheDocument();
  });

  it('rejects a malformed email', async () => {
    const { user } = setup();
    await screen.findByRole('button', { name: /starter pack/i });
    await user.click(screen.getByRole('button', { name: /starter pack/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await fill(user, { ...CUSTOMER, Email: 'nope' });
    await fill(user, ADDRESS);
    await user.click(screen.getByRole('button', { name: /review order/i }));

    expect(await screen.findByText(/that email looks wrong/i)).toBeInTheDocument();
  });

  it('reviews the order without inventing a total', async () => {
    const { user } = setup();
    await chooseStarterPack(user);

    expect(await screen.findByRole('heading', { name: /check your order/i })).toBeInTheDocument();
    expect(screen.getByText(/someone@example\.com/)).toBeInTheDocument();
    // Fees are the server's to compute, so no total is shown yet.
    expect(screen.queryByTestId('total')).not.toBeInTheDocument();
  });

  it('renders the server-computed amounts on the payment step', async () => {
    const { user } = setup();
    await chooseStarterPack(user);
    await user.click(screen.getByRole('button', { name: /confirm order/i }));

    expect(await screen.findByRole('heading', { name: /^payment$/i })).toBeInTheDocument();
    // 20.000 + 1.500 + 800 = 22.300, and it comes from the API, not from us.
    expect(screen.getByTestId('total')).toHaveTextContent('22.300,00');
    expect(screen.getByText(/LR-MOCK/)).toBeInTheDocument();
  });

  it('validates the card before sending anything to the gateway', async () => {
    const { user, client } = setup();
    const paySpy = jest.spyOn(client, 'pay');
    await chooseStarterPack(user);
    await user.click(screen.getByRole('button', { name: /confirm order/i }));
    await screen.findByRole('heading', { name: /^payment$/i });

    await user.type(screen.getByLabelText(/card number/i), '4242424242424241');
    await fill(user, CARD);
    await user.click(screen.getByRole('button', { name: /^pay/i }));

    expect(await screen.findByText(/card number is not valid/i)).toBeInTheDocument();
    expect(paySpy).not.toHaveBeenCalled();
  });

  it('completes the five steps and reports approval', async () => {
    const { user } = setup();
    await chooseStarterPack(user);
    await user.click(screen.getByRole('button', { name: /confirm order/i }));
    await screen.findByRole('heading', { name: /^payment$/i });
    await payWithCard(user);

    expect(await screen.findByRole('heading', { name: /payment approved/i })).toBeInTheDocument();
    expect(screen.getByText(/20 spins added/i)).toBeInTheDocument();
  });

  it('grants the purchased credits to the game exactly once', async () => {
    const { user, store } = setup();
    const before = store.getState().game.credits;

    await chooseStarterPack(user);
    await user.click(screen.getByRole('button', { name: /confirm order/i }));
    await screen.findByRole('heading', { name: /^payment$/i });
    await payWithCard(user);

    await screen.findByRole('heading', { name: /payment approved/i });
    await waitFor(() => expect(store.getState().game.credits).toBe(before + 20));
    // Still exactly one grant after further polls settle.
    await waitFor(() => expect(store.getState().game.credits).toBe(before + 20));
  });

  it('reports a decline without granting credits', async () => {
    const { user, store } = setup(createMockCheckoutClient({ outcome: 'DECLINED' }));
    const before = store.getState().game.credits;

    await chooseStarterPack(user);
    await user.click(screen.getByRole('button', { name: /confirm order/i }));
    await screen.findByRole('heading', { name: /^payment$/i });
    await payWithCard(user);

    expect(await screen.findByRole('heading', { name: /payment declined/i })).toBeInTheDocument();
    expect(store.getState().game.credits).toBe(before);
  });

  it('surfaces an out-of-stock refusal on the review step', async () => {
    const client = createMockCheckoutClient();
    jest
      .spyOn(client, 'createTransaction')
      .mockRejectedValue(new ApiError('OUT_OF_STOCK', 'Only 2 packs left', 409));
    const { user } = setup(client);

    await chooseStarterPack(user);
    await user.click(screen.getByRole('button', { name: /confirm order/i }));

    expect(await screen.findByText(/only 2 packs left/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /check your order/i })).toBeInTheDocument();
  });

  it('lands a server field rejection on the offending input, not a banner', async () => {
    // Mirrors the live API, which reports nested fields with dotted paths.
    const client = createMockCheckoutClient();
    jest.spyOn(client, 'createTransaction').mockRejectedValue(
      new ApiError('VALIDATION_FAILED', 'Invalid request', 400, [
        { field: 'customer.email', message: 'email must be an email' },
      ]),
    );
    const { user } = setup(client);

    await chooseStarterPack(user);
    await user.click(screen.getByRole('button', { name: /confirm order/i }));

    // Back on the details form, with the message attached to the email field.
    expect(await screen.findByRole('heading', { name: /where should it go/i })).toBeInTheDocument();
    const email = screen.getByLabelText(/email/i);
    expect(email).toHaveAccessibleDescription('email must be an email');
    expect(email).toBeInvalid();
  });

  it('never writes card details to storage', async () => {
    const { user } = setup();
    await chooseStarterPack(user);
    await user.click(screen.getByRole('button', { name: /confirm order/i }));
    await screen.findByRole('heading', { name: /^payment$/i });
    await payWithCard(user);
    await screen.findByRole('heading', { name: /payment approved/i });

    const stored = window.localStorage.getItem('lucky-reels.checkout.v1') ?? '';
    expect(stored).toContain('LR-MOCK');
    expect(stored).not.toContain('4242424242424242');
    // '987' is the CVV and appears nowhere else in the draft, unlike '123'
    // which is a substring of the phone number.
    expect(stored).not.toContain('987');
    expect(stored).not.toMatch(/tok_stagtest/);
  });

  it('resumes from a stored reference rather than the stored step', async () => {
    const client = createMockCheckoutClient();
    const created = await client.createTransaction({
      productId: 'prd_starter',
      quantity: 1,
      customer: { email: 'a@b.co', fullName: 'A', phone: '+57300' },
      delivery: { addressLine: 'x', city: 'y', region: 'z', postalCode: '1' },
    });
    await client.pay(created.reference, {
      paymentToken: 'tok',
      acceptanceToken: 'acc',
      installments: 1,
    });

    // The tab died on step 2, but the transaction moved on without it.
    saveCheckout({
      reference: created.reference,
      step: 1,
      productId: 'prd_starter',
      quantity: 1,
      customer: {},
      delivery: {},
    });

    setup(client);

    expect(await screen.findByRole('heading', { name: /payment approved/i })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(created.reference))).toBeInTheDocument();
  });

  it('starts clean when there is nothing stored', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: /pick a pack/i })).toBeInTheDocument();
  });
});
