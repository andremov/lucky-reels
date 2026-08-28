import { configureStore } from '@reduxjs/toolkit';
import { createMockCheckoutClient, MOCK_PRODUCTS } from './checkout-client.mock';
import type { CheckoutClient } from './checkout-client';
import {
  checkoutReducer,
  checkoutReset,
  createTransaction,
  customerChanged,
  deliveryChanged,
  loadProducts,
  payTransaction,
  productSelected,
  refreshTransaction,
  stepChanged,
  toPersisted,
  type CheckoutState,
} from './checkout-slice';
import { ApiError } from './checkout-types';

function makeStore(client: CheckoutClient) {
  return configureStore({
    reducer: { checkout: checkoutReducer },
    middleware: (getDefault) => getDefault({ thunk: { extraArgument: { client } } }),
  });
}

const CUSTOMER = { email: 'a@b.co', fullName: 'Someone Real', phone: '+573001234567' };
const DELIVERY = {
  addressLine: 'Calle 1 # 2-3',
  city: 'Bogota',
  region: 'Cundinamarca',
  postalCode: '110111',
};

/** Product step -> a created PENDING transaction, which lands on the summary. */
async function advanceToSummary(store: ReturnType<typeof makeStore>, productId = 'prd_starter') {
  await store.dispatch(loadProducts());
  store.dispatch(productSelected({ productId }));
  store.dispatch(customerChanged(CUSTOMER));
  store.dispatch(deliveryChanged(DELIVERY));
  await store.dispatch(createTransaction());
  return store.getState().checkout;
}

/** As above, then on to the card step. */
async function advanceToPayment(store: ReturnType<typeof makeStore>, productId = 'prd_starter') {
  await advanceToSummary(store, productId);
  store.dispatch(stepChanged('payment'));
  return store.getState().checkout;
}

const state = (store: ReturnType<typeof makeStore>): CheckoutState => store.getState().checkout;

describe('checkout slice', () => {
  it('starts on the product step with nothing selected', () => {
    const s = state(makeStore(createMockCheckoutClient()));
    expect(s.step).toBe('product');
    expect(s.selectedProductId).toBeNull();
    expect(s.reference).toBeNull();
  });

  it('loads products and marks them ready', async () => {
    const store = makeStore(createMockCheckoutClient());
    await store.dispatch(loadProducts());
    expect(state(store).productsStatus).toBe('ready');
    expect(state(store).products).toHaveLength(MOCK_PRODUCTS.length);
  });

  it('replaces products wholesale on refetch so stock is never cached', async () => {
    const client = createMockCheckoutClient();
    const store = makeStore(client);
    await store.dispatch(loadProducts());
    expect(state(store).products[0].stock.available).toBe(7);

    // Someone else reserves two units.
    await client.createTransaction({
      productId: 'prd_starter',
      quantity: 2,
      customer: CUSTOMER,
      delivery: DELIVERY,
    });

    await store.dispatch(loadProducts());
    expect(state(store).products[0].stock.available).toBe(5);
  });

  it('surfaces a rising stock number rather than treating it as stale', async () => {
    const client = createMockCheckoutClient({ outcome: 'DECLINED' });
    const store = makeStore(client);
    const created = await client.createTransaction({
      productId: 'prd_starter',
      quantity: 3,
      customer: CUSTOMER,
      delivery: DELIVERY,
    });
    await store.dispatch(loadProducts());
    expect(state(store).products[0].stock.available).toBe(4);

    // Their payment fails, so the reservation is released.
    await client.pay(created.reference, {
      paymentToken: 'tok',
      acceptanceToken: 'acc',
      installments: 1,
    });
    await client.getTransaction(created.reference);

    await store.dispatch(loadProducts());
    expect(state(store).products[0].stock.available).toBe(7);
  });

  describe('creating the transaction', () => {
    it('stores the server reference and amounts and lands on the summary', async () => {
      const store = makeStore(createMockCheckoutClient());
      const s = await advanceToSummary(store);

      expect(s.reference).toMatch(/^LR-MOCK/);
      expect(s.status).toBe('PENDING');
      expect(s.step).toBe('summary');
      expect(s.expiresAt).toBeTruthy();
    });

    it('keeps the server-computed total instead of summing client-side', async () => {
      const store = makeStore(createMockCheckoutClient());
      const { amounts } = await advanceToPayment(store);

      expect(amounts).toEqual({
        productCents: 2000000,
        baseFeeCents: 150000,
        deliveryFeeCents: 80000,
        totalCents: 2230000,
        currency: 'COP',
      });
      // The total is whatever the server said, not a re-derived sum.
      expect(amounts!.totalCents).toBe(2230000);
    });

    it('does not reserve twice for the same order', async () => {
      const client = createMockCheckoutClient();
      const spy = jest.spyOn(client, 'createTransaction');
      const store = makeStore(client);

      await advanceToSummary(store);
      const first = state(store).reference;
      await store.dispatch(createTransaction());

      expect(spy).toHaveBeenCalledTimes(1);
      expect(state(store).reference).toBe(first);
    });

    it('reserves afresh when the customer switches pack', async () => {
      const client = createMockCheckoutClient();
      const spy = jest.spyOn(client, 'createTransaction');
      const store = makeStore(client);

      await advanceToSummary(store);
      const first = state(store).reference;

      store.dispatch(productSelected({ productId: 'prd_high_roller' }));
      expect(state(store).reference).toBeNull();
      expect(state(store).amounts).toBeNull();

      await store.dispatch(createTransaction());
      expect(spy).toHaveBeenCalledTimes(2);
      expect(state(store).reference).not.toBe(first);
    });

    it('refuses to submit with no product selected', async () => {
      const store = makeStore(createMockCheckoutClient());
      await store.dispatch(createTransaction());
      expect(state(store).error?.code).toBe('VALIDATION_FAILED');
      expect(state(store).reference).toBeNull();
    });

    it('records OUT_OF_STOCK by code and stays on the summary', async () => {
      const store = makeStore(createMockCheckoutClient());
      await store.dispatch(loadProducts());
      store.dispatch(productSelected({ productId: 'prd_high_roller', quantity: 5 }));
      store.dispatch(customerChanged(CUSTOMER));
      store.dispatch(deliveryChanged(DELIVERY));
      store.dispatch(stepChanged('summary'));
      await store.dispatch(createTransaction());

      expect(state(store).error?.code).toBe('OUT_OF_STOCK');
      expect(state(store).step).toBe('summary');
      expect(state(store).submitting).toBe(false);
    });
  });

  describe('payment', () => {
    it('moves to the result step and begins polling', async () => {
      const store = makeStore(createMockCheckoutClient());
      await advanceToPayment(store);
      await store.dispatch(
        payTransaction({ paymentToken: 'tok', acceptanceToken: 'acc', installments: 1 }),
      );

      expect(state(store).step).toBe('result');
      expect(state(store).polling).toBe(true);
    });

    it('resolves to APPROVED with credits and a player token', async () => {
      const store = makeStore(createMockCheckoutClient());
      await advanceToPayment(store);
      await store.dispatch(
        payTransaction({ paymentToken: 'tok', acceptanceToken: 'acc', installments: 1 }),
      );
      await store.dispatch(refreshTransaction());

      const s = state(store);
      expect(s.status).toBe('APPROVED');
      expect(s.polling).toBe(false);
      expect(s.transaction?.creditsGranted).toBe(20);
      expect(s.playerToken).toBe(`plr_mock_${s.reference}`);
    });

    it('resolves to DECLINED without granting credits', async () => {
      const store = makeStore(createMockCheckoutClient({ outcome: 'DECLINED' }));
      await advanceToPayment(store);
      await store.dispatch(
        payTransaction({ paymentToken: 'tok', acceptanceToken: 'acc', installments: 1 }),
      );
      await store.dispatch(refreshTransaction());

      expect(state(store).status).toBe('DECLINED');
      expect(state(store).transaction?.creditsGranted).toBeUndefined();
      expect(state(store).playerToken).toBeNull();
    });

    it('stays PENDING while the gateway has not decided', async () => {
      const store = makeStore(createMockCheckoutClient({ pendingPolls: 2 }));
      await advanceToPayment(store);
      await store.dispatch(
        payTransaction({ paymentToken: 'tok', acceptanceToken: 'acc', installments: 1 }),
      );

      await store.dispatch(refreshTransaction());
      expect(state(store).status).toBe('PENDING');
      expect(state(store).polling).toBe(true);

      await store.dispatch(refreshTransaction());
      await store.dispatch(refreshTransaction());
      expect(state(store).status).toBe('APPROVED');
      expect(state(store).polling).toBe(false);
    });

    it('does not charge twice when pay is retried with the same reference', async () => {
      const client = createMockCheckoutClient();
      const spy = jest.spyOn(client, 'pay');
      const store = makeStore(client);
      const { reference } = await advanceToPayment(store);

      const input = { paymentToken: 'tok', acceptanceToken: 'acc', installments: 1 };
      await store.dispatch(payTransaction(input));
      await store.dispatch(payTransaction(input));

      // Both calls carried the same reference, which is what makes the retry safe.
      expect(spy.mock.calls.map(([ref]) => ref)).toEqual([reference, reference]);
      await store.dispatch(refreshTransaction());
      expect(state(store).transaction?.creditsGranted).toBe(20);
    });

    it('treats PAYMENT_REJECTED as a DECLINED outcome, not a form error', async () => {
      const client = createMockCheckoutClient();
      jest
        .spyOn(client, 'pay')
        .mockRejectedValue(new ApiError('PAYMENT_REJECTED', 'Card refused', 402));
      const store = makeStore(client);
      await advanceToPayment(store);
      await store.dispatch(
        payTransaction({ paymentToken: 'tok', acceptanceToken: 'acc', installments: 1 }),
      );

      expect(state(store).status).toBe('DECLINED');
      expect(state(store).step).toBe('result');
    });

    it('sends an expired reservation to the result step as ERROR', async () => {
      const client = createMockCheckoutClient();
      jest
        .spyOn(client, 'pay')
        .mockRejectedValue(new ApiError('TRANSACTION_EXPIRED', 'Reservation lapsed', 410));
      const store = makeStore(client);
      await advanceToPayment(store);
      await store.dispatch(
        payTransaction({ paymentToken: 'tok', acceptanceToken: 'acc', installments: 1 }),
      );

      expect(state(store).status).toBe('ERROR');
      expect(state(store).step).toBe('result');
      expect(state(store).error?.code).toBe('TRANSACTION_EXPIRED');
    });
  });

  describe('resume', () => {
    it('rebuilds state from a reference alone', async () => {
      const client = createMockCheckoutClient();
      const created = await client.createTransaction({
        productId: 'prd_starter',
        quantity: 1,
        customer: CUSTOMER,
        delivery: DELIVERY,
      });

      // A fresh store, as after a refresh, knowing only the reference.
      const store = makeStore(client);
      await store.dispatch(refreshTransaction(created.reference));

      expect(state(store).reference).toBe(created.reference);
      expect(state(store).amounts?.totalCents).toBe(2230000);
      expect(state(store).status).toBe('PENDING');
    });

    it('maps an unrecognised status to ERROR', async () => {
      const client = createMockCheckoutClient();
      jest.spyOn(client, 'getTransaction').mockResolvedValue({
        reference: 'LR-X',
        status: 'WEIRD' as never,
        amounts: {
          productCents: 1,
          baseFeeCents: 0,
          deliveryFeeCents: 0,
          totalCents: 1,
          currency: 'COP',
        },
        product: { id: 'p', name: 'p', spinsGranted: 1 },
      });
      const store = makeStore(client);
      await store.dispatch(refreshTransaction('LR-X'));
      expect(state(store).status).toBe('ERROR');
    });

    it('persists the reference and draft but never card data', async () => {
      const store = makeStore(createMockCheckoutClient());
      const s = await advanceToPayment(store);
      const persisted = toPersisted(s);

      expect(persisted.reference).toBe(s.reference);
      expect(persisted.customer).toEqual(CUSTOMER);
      expect(JSON.stringify(persisted)).not.toMatch(/cardNumber|cvv|paymentToken/i);
    });
  });

  it('resets back to the initial state', async () => {
    const store = makeStore(createMockCheckoutClient());
    await advanceToPayment(store);
    store.dispatch(checkoutReset());

    expect(state(store).reference).toBeNull();
    expect(state(store).step).toBe('product');
    expect(state(store).products).toEqual([]);
  });
});
