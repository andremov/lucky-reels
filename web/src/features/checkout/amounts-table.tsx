import type { Amounts } from './checkout-types';
import { formatCents } from './money';

/**
 * Renders the server's numbers verbatim. Nothing here adds anything up — the
 * total is whatever the API said it is, or the customer would see a figure
 * different from the one they were charged.
 */
export default function AmountsTable({ amounts }: { amounts: Amounts }) {
  const row = (label: string, cents: number) => (
    <div className="flex justify-between">
      <dt className="text-white/60">{label}</dt>
      <dd>{formatCents(cents, amounts.currency)}</dd>
    </div>
  );

  return (
    <dl className="flex flex-col gap-2 rounded-xl border border-case-edge p-4 text-sm">
      {row('Pack', amounts.productCents)}
      {row('Base fee', amounts.baseFeeCents)}
      {row('Delivery fee', amounts.deliveryFeeCents)}
      <div className="mt-1 flex justify-between border-t border-case-edge pt-2 text-base font-semibold">
        <dt>Total</dt>
        <dd data-testid="total" className="text-gold">
          {formatCents(amounts.totalCents, amounts.currency)}
        </dd>
      </div>
    </dl>
  );
}
