import { formatCents } from './money';

// Intl inserts a non-breaking space after the symbol; compare on digits.
const digits = (s: string) => s.replace(/[^\d.,]/g, '');

describe('formatCents', () => {
  it('renders whole COP amounts from integer cents', () => {
    expect(digits(formatCents(2000000))).toBe('20.000,00');
  });

  it('keeps the cents portion', () => {
    expect(digits(formatCents(2230000))).toBe('22.300,00');
    expect(digits(formatCents(150050))).toBe('1.500,50');
  });

  it('handles zero', () => {
    expect(digits(formatCents(0))).toBe('0,00');
  });

  it('does not lose precision on large amounts', () => {
    expect(digits(formatCents(999999999))).toBe('9.999.999,99');
  });
});
