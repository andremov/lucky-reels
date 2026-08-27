import { screen } from '@testing-library/react';
import { renderWithStore } from '@/test/render-with-store';
import App from './app';

it('renders the machine', () => {
  renderWithStore(<App />);

  expect(screen.getByRole('heading', { name: /lucky reels/i })).toBeInTheDocument();
});
