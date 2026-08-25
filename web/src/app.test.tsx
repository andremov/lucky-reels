import { render, screen } from '@testing-library/react';
import App from './app';

it('renders the app title', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /lucky reels/i })).toBeInTheDocument();
});
