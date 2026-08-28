import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore } from '@/app/store';
import { createHttpCheckoutClient } from '@/features/checkout/checkout-client';
import { createMockCheckoutClient } from '@/features/checkout/checkout-client.mock';
import App from './app';
import './index.css';

// The API is not deployed yet; without VITE_API_URL the app runs on the stub.
// Read structurally rather than via vite/client types, so tsconfig stays untouched.
const baseUrl = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  ?.VITE_API_URL;
const store = createStore(
  baseUrl ? createHttpCheckoutClient(baseUrl) : createMockCheckoutClient(),
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
