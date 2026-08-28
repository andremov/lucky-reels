import {
  ApiError,
  type ApiErrorCode,
  type CreateTransactionInput,
  type CreatedTransaction,
  type DeliveryView,
  type PayInput,
  type Product,
  type TransactionView,
} from './checkout-types';

/**
 * The seam the contract asks for: swapping the stub for the live API touches
 * only which implementation is handed to the store.
 */
export type CheckoutClient = {
  listProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product>;
  createTransaction(input: CreateTransactionInput): Promise<CreatedTransaction>;
  pay(reference: string, input: PayInput): Promise<{ reference: string; status: string }>;
  getTransaction(reference: string): Promise<TransactionView>;
  getDelivery(reference: string): Promise<DeliveryView>;
};

async function toApiError(response: Response): Promise<ApiError> {
  let code: ApiErrorCode = 'INTERNAL_ERROR';
  let message = response.statusText || 'Request failed';
  let details = undefined;

  try {
    const body = await response.json();
    if (body?.error?.code) {
      code = body.error.code;
      message = body.error.message ?? message;
      details = body.error.details;
    }
  } catch {
    // Non-JSON body (proxy error, HTML page). Keep the generic code.
  }

  return new ApiError(code, message, response.status, details ?? []);
}

export function createHttpCheckoutClient(baseUrl: string): CheckoutClient {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });

    if (!response.ok) throw await toApiError(response);
    return (await response.json()) as T;
  }

  const post = <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) });

  return {
    listProducts: () => request<Product[]>('/products'),
    getProduct: (id) => request<Product>(`/products/${encodeURIComponent(id)}`),
    createTransaction: (input) => post<CreatedTransaction>('/transactions', input),
    pay: (reference, input) =>
      post(`/transactions/${encodeURIComponent(reference)}/pay`, input),
    getTransaction: (reference) =>
      request<TransactionView>(`/transactions/${encodeURIComponent(reference)}`),
    getDelivery: (reference) =>
      request<DeliveryView>(`/deliveries/${encodeURIComponent(reference)}`),
  };
}
