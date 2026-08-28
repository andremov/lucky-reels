import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CheckoutClient } from './checkout-client';
import { clearCheckout, saveCheckout } from './checkout-storage';
import {
  ApiError,
  isTerminal,
  normalizeStatus,
  type Amounts,
  type ApiErrorCode,
  type Customer,
  type Delivery,
  type FieldError,
  type Product,
  type TransactionStatus,
  type TransactionView,
} from './checkout-types';

export const STEPS = ['product', 'details', 'summary', 'payment', 'result'] as const;
export type Step = (typeof STEPS)[number];
export const stepIndex = (step: Step) => STEPS.indexOf(step);

export type ThunkExtra = { client: CheckoutClient };

export type CheckoutError = { code: ApiErrorCode; message: string; details: FieldError[] };

export type CheckoutState = {
  step: Step;
  products: Product[];
  productsStatus: 'idle' | 'loading' | 'ready' | 'failed';
  selectedProductId: string | null;
  quantity: number;
  customer: Partial<Customer>;
  delivery: Partial<Delivery>;
  reference: string | null;
  amounts: Amounts | null;
  expiresAt: string | null;
  status: TransactionStatus | null;
  transaction: TransactionView | null;
  playerToken: string | null;
  submitting: boolean;
  polling: boolean;
  pollTimedOut: boolean;
  error: CheckoutError | null;
};

const initialState: CheckoutState = {
  step: 'product',
  products: [],
  productsStatus: 'idle',
  selectedProductId: null,
  quantity: 1,
  customer: {},
  delivery: {},
  reference: null,
  amounts: null,
  expiresAt: null,
  status: null,
  transaction: null,
  playerToken: null,
  submitting: false,
  polling: false,
  pollTimedOut: false,
  error: null,
};

function toCheckoutError(error: unknown): CheckoutError {
  if (error instanceof ApiError) {
    return { code: error.code, message: error.message, details: error.details };
  }
  return {
    code: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : 'Something went wrong',
    details: [],
  };
}

export const loadProducts = createAsyncThunk<
  Product[],
  void,
  { extra: ThunkExtra; rejectValue: CheckoutError }
>('checkout/loadProducts', async (_, { extra, rejectWithValue }) => {
  try {
    return await extra.client.listProducts();
  } catch (error) {
    return rejectWithValue(toCheckoutError(error));
  }
});

export const createTransaction = createAsyncThunk<
  { reference: string; status: TransactionStatus; amounts: Amounts; expiresAt: string },
  void,
  { extra: ThunkExtra; state: { checkout: CheckoutState }; rejectValue: CheckoutError }
>('checkout/createTransaction', async (_, { extra, getState, rejectWithValue }) => {
  const { selectedProductId, quantity, customer, delivery } = getState().checkout;
  if (!selectedProductId) {
    return rejectWithValue({
      code: 'VALIDATION_FAILED',
      message: 'No product selected',
      details: [],
    });
  }
  try {
    const created = await extra.client.createTransaction({
      productId: selectedProductId,
      quantity,
      customer: customer as Customer,
      delivery: delivery as Delivery,
    });
    return { ...created, status: normalizeStatus(created.status) };
  } catch (error) {
    return rejectWithValue(toCheckoutError(error));
  }
});

export const payTransaction = createAsyncThunk<
  void,
  { paymentToken: string; acceptanceToken: string; installments: number },
  { extra: ThunkExtra; state: { checkout: CheckoutState }; rejectValue: CheckoutError }
>('checkout/pay', async (input, { extra, getState, rejectWithValue }) => {
  const { reference } = getState().checkout;
  if (!reference) {
    return rejectWithValue({ code: 'TRANSACTION_NOT_FOUND', message: 'No reference', details: [] });
  }
  try {
    // Safe to retry with the same reference: the server returns the current
    // state rather than charging twice.
    await extra.client.pay(reference, input);
  } catch (error) {
    return rejectWithValue(toCheckoutError(error));
  }
});

export const refreshTransaction = createAsyncThunk<
  TransactionView,
  string | undefined,
  { extra: ThunkExtra; state: { checkout: CheckoutState }; rejectValue: CheckoutError }
>('checkout/refresh', async (explicitRef, { extra, getState, rejectWithValue }) => {
  const reference = explicitRef ?? getState().checkout.reference;
  if (!reference) {
    return rejectWithValue({ code: 'TRANSACTION_NOT_FOUND', message: 'No reference', details: [] });
  }
  try {
    const view = await extra.client.getTransaction(reference);
    return { ...view, status: normalizeStatus(view.status) };
  } catch (error) {
    return rejectWithValue(toCheckoutError(error));
  }
});

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState,
  reducers: {
    hydrated(state, action: PayloadAction<Partial<CheckoutState>>) {
      Object.assign(state, action.payload);
    },
    stepChanged(state, action: PayloadAction<Step>) {
      state.step = action.payload;
      state.error = null;
    },
    productSelected(state, action: PayloadAction<{ productId: string; quantity?: number }>) {
      state.selectedProductId = action.payload.productId;
      state.quantity = action.payload.quantity ?? 1;
      state.error = null;
    },
    customerChanged(state, action: PayloadAction<Partial<Customer>>) {
      state.customer = { ...state.customer, ...action.payload };
    },
    deliveryChanged(state, action: PayloadAction<Partial<Delivery>>) {
      state.delivery = { ...state.delivery, ...action.payload };
    },
    pollingStarted(state) {
      state.polling = true;
      state.pollTimedOut = false;
    },
    pollingStopped(state) {
      state.polling = false;
    },
    pollingTimedOut(state) {
      state.polling = false;
      state.pollTimedOut = true;
    },
    errorCleared(state) {
      state.error = null;
    },
    checkoutReset() {
      clearCheckout();
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadProducts.pending, (state) => {
        state.productsStatus = 'loading';
        state.error = null;
      })
      .addCase(loadProducts.fulfilled, (state, action) => {
        state.productsStatus = 'ready';
        // Replaced wholesale, never merged: stock must not be cached.
        state.products = action.payload;
      })
      .addCase(loadProducts.rejected, (state, action) => {
        state.productsStatus = 'failed';
        state.error = action.payload ?? toCheckoutError(action.error);
      })

      .addCase(createTransaction.pending, (state) => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(createTransaction.fulfilled, (state, action) => {
        state.submitting = false;
        // Held immediately — this is what makes a refresh resumable.
        state.reference = action.payload.reference;
        state.status = action.payload.status;
        state.amounts = action.payload.amounts;
        state.expiresAt = action.payload.expiresAt;
        state.step = 'payment';
      })
      .addCase(createTransaction.rejected, (state, action) => {
        state.submitting = false;
        const error = action.payload ?? toCheckoutError(action.error);
        state.error = error;
        // The server rejected a field, not the order. Send them back to the
        // form that owns it rather than showing a dead end on the summary.
        if (error.code === 'VALIDATION_FAILED' && error.details.length > 0) {
          state.step = 'details';
        }
      })

      .addCase(payTransaction.pending, (state) => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(payTransaction.fulfilled, (state) => {
        state.submitting = false;
        state.step = 'result';
        state.polling = true;
      })
      .addCase(payTransaction.rejected, (state, action) => {
        state.submitting = false;
        const error = action.payload ?? toCheckoutError(action.error);
        state.error = error;
        // A refused card or a lapsed reservation is an outcome, not a form error.
        if (error.code === 'PAYMENT_REJECTED') {
          state.status = 'DECLINED';
          state.step = 'result';
        } else if (error.code === 'TRANSACTION_EXPIRED') {
          state.status = 'ERROR';
          state.step = 'result';
        }
      })

      .addCase(refreshTransaction.fulfilled, (state, action) => {
        state.transaction = action.payload;
        state.status = action.payload.status;
        state.amounts = action.payload.amounts;
        state.reference = action.payload.reference;
        if (action.payload.playerToken) state.playerToken = action.payload.playerToken;
        if (isTerminal(action.payload.status)) {
          state.polling = false;
          state.step = 'result';
        }
      })
      .addCase(refreshTransaction.rejected, (state, action) => {
        state.error = action.payload ?? toCheckoutError(action.error);
      });
  },
});

export const {
  hydrated,
  stepChanged,
  productSelected,
  customerChanged,
  deliveryChanged,
  pollingStarted,
  pollingStopped,
  pollingTimedOut,
  errorCleared,
  checkoutReset,
} = checkoutSlice.actions;

export const checkoutReducer = checkoutSlice.reducer;

/** Everything worth surviving a refresh, and nothing that must not. */
export function toPersisted(state: CheckoutState) {
  return {
    reference: state.reference,
    step: stepIndex(state.step),
    productId: state.selectedProductId,
    quantity: state.quantity,
    customer: state.customer,
    delivery: state.delivery,
    playerToken: state.playerToken,
  };
}

export function persist(state: CheckoutState) {
  saveCheckout(toPersisted(state));
}
