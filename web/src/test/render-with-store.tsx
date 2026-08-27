import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore, type AppStore } from '@/app/store';

export function renderWithStore(ui: ReactElement, store: AppStore = createStore()) {
  return {
    store,
    ...render(<Provider store={store}>{ui}</Provider>),
  };
}
