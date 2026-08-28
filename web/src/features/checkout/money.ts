const FORMATTERS = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string): Intl.NumberFormat {
  let formatter = FORMATTERS.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    });
    FORMATTERS.set(currency, formatter);
  }
  return formatter;
}

/**
 * Integer cents -> display string. The API never sends floats, so the only
 * division happens here, at the edge, for presentation.
 */
export function formatCents(cents: number, currency = 'COP'): string {
  return formatterFor(currency).format(cents / 100);
}
