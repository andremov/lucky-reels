import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { createTransaction, stepChanged } from './checkout-slice';
import { formatCents } from './money';
import { Button, ErrorNote } from './ui';

export default function StepSummary() {
  const dispatch = useAppDispatch();
  const { products, selectedProductId, quantity, customer, delivery, submitting, error } =
    useAppSelector((s) => s.checkout);

  const product = products.find((p) => p.id === selectedProductId);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Check your order</h2>

      {product ? (
        <dl className="flex flex-col gap-2 rounded-xl border border-case-edge p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-white/60">Pack</dt>
            <dd>
              {product.name} × {quantity}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-white/60">Spins</dt>
            <dd>{product.spinsGranted * quantity}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-white/60">Price</dt>
            <dd>{formatCents(product.priceCents, product.currency)}</dd>
          </div>
        </dl>
      ) : null}

      <dl className="flex flex-col gap-2 rounded-xl border border-case-edge p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-white/60">Name</dt>
          <dd>{customer.fullName}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-white/60">Email</dt>
          <dd>{customer.email}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="shrink-0 text-white/60">Deliver to</dt>
          <dd className="text-right">
            {delivery.addressLine}, {delivery.city}, {delivery.region} {delivery.postalCode}
          </dd>
        </div>
      </dl>

      {/*
        Fees are not shown yet on purpose. The server computes them and returns
        them with the transaction, so the breakdown appears on the next step
        rather than being guessed at here.
      */}
      <p className="text-xs text-white/50">
        Base and delivery fees are calculated when you confirm, and shown before you pay.
      </p>

      {error ? <ErrorNote>{error.message}</ErrorNote> : null}

      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => dispatch(stepChanged('details'))}>
          Back
        </Button>
        <Button disabled={submitting || !product} onClick={() => dispatch(createTransaction())}>
          {submitting ? 'Reserving…' : 'Confirm order'}
        </Button>
      </div>
    </section>
  );
}
