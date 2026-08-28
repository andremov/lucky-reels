import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore } from '@/app/store';
import { createHttpCheckoutClient } from '@/features/checkout/checkout-client';
import { createMockCheckoutClient } from '@/features/checkout/checkout-client.mock';
import { createLiveTokenizer, createStubTokenizer } from '@/features/checkout/card-tokenizer';
import { TokenizerProvider } from '@/features/checkout/tokenizer-context';
import App from './app';
import './index.css';

// The API is not deployed yet; without VITE_API_URL the app runs on the stub.
// Read structurally rather than via vite/client types, so tsconfig stays untouched.
const env =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const baseUrl = env.VITE_API_URL;
const store = createStore(
  baseUrl ? createHttpCheckoutClient(baseUrl) : createMockCheckoutClient(),
);

// With no provider key configured the stub tokenizer runs and behaviour is
// identical to before. Configured means real browser-side tokenisation.
const gatewayUrl = env.VITE_GATEWAY_URL;
const gatewayKey = env.VITE_GATEWAY_PUBLIC_KEY;
const tokenizer =
  gatewayUrl && gatewayKey ? createLiveTokenizer(gatewayUrl, gatewayKey) : createStubTokenizer();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <TokenizerProvider tokenizer={tokenizer}>
        <App />
      </TokenizerProvider>
    </Provider>
  </StrictMode>,
);
