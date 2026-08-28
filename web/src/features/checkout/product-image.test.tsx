import { fireEvent, render, screen } from '@testing-library/react';
import ProductImage, { initialsFor } from './product-image';

describe('initialsFor', () => {
  it.each([
    ['Starter Pack', 'SP'],
    ['High Roller', 'HR'],
    ['Player Pack Deluxe Edition', 'PP'],
    ['Solo', 'S'],
  ])('reduces %s to %s', (name, expected) => {
    expect(initialsFor(name)).toBe(expected);
  });

  it('survives odd spacing', () => {
    expect(initialsFor('  Starter   Pack ')).toBe('SP');
  });
});

describe('ProductImage', () => {
  it('renders the image with the product name as alt text', () => {
    render(<ProductImage src="https://example.test/a.jpg" name="Starter Pack" />);
    const img = screen.getByRole('img', { name: 'Starter Pack' });
    expect(img).toHaveAttribute('src', 'https://example.test/a.jpg');
    expect(img.tagName).toBe('IMG');
  });

  it('reserves the box up front so nothing shifts as it loads', () => {
    render(<ProductImage src="https://example.test/a.jpg" name="Starter Pack" size={64} />);
    const img = screen.getByRole('img', { name: 'Starter Pack' });
    expect(img).toHaveAttribute('width', '64');
    expect(img).toHaveAttribute('height', '64');
  });

  it('swaps to a lettered placeholder when the remote image fails', () => {
    render(<ProductImage src="https://example.test/missing.jpg" name="High Roller" />);
    fireEvent.error(screen.getByRole('img', { name: 'High Roller' }));

    // Still labelled, still an img role, but no broken <img> on screen.
    const placeholder = screen.getByRole('img', { name: 'High Roller' });
    expect(placeholder.tagName).not.toBe('IMG');
    expect(placeholder).toHaveTextContent('HR');
  });

  it('keeps the same footprint after a failure, so the layout is unchanged', () => {
    const { rerender } = render(<ProductImage src="https://x.test/a.jpg" name="Player Pack" size={48} />);
    fireEvent.error(screen.getByRole('img', { name: 'Player Pack' }));
    const placeholder = screen.getByRole('img', { name: 'Player Pack' });
    expect(placeholder).toHaveStyle({ width: '48px', height: '48px' });
    rerender(<ProductImage src="https://x.test/a.jpg" name="Player Pack" size={48} />);
  });

  it('shows the placeholder when the API sends no image at all', () => {
    render(<ProductImage name="Starter Pack" />);
    const placeholder = screen.getByRole('img', { name: 'Starter Pack' });
    expect(placeholder.tagName).not.toBe('IMG');
    expect(placeholder).toHaveTextContent('SP');
  });
});
