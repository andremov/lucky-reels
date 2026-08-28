import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { stepChanged } from './checkout-slice';
import AmountsTable from './amounts-table';
import { Button, ErrorNote } from './ui';

export default function StepSummary() {
  const dispatch = useAppDispatch();
  const { products, selectedProductId, quantity, customer, delivery, amounts, reference, error } =
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
        Product amount, base fee and delivery fee, exactly as the server
        computed them when it reserved the stock. Nothing here is summed.
      */}
      {amounts ? <AmountsTable amounts={amounts} /> : null}

      {reference ? (
        <p className="text-xs text-white/50">
          Reference <span className="font-mono text-white/80">{reference}</span>
        </p>
      ) : null}

      {error ? <ErrorNote>{error.message}</ErrorNote> : null}

      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => dispatch(stepChanged('details'))}>
          Back
        </Button>
        {/* Leads to the payment step, which owns the "Pay with credit card"
            button and the card modal. Two identical labels in a row would be
            worse than one clear one. */}
        <Button disabled={!amounts} onClick={() => dispatch(stepChanged('payment'))}>
          Continue to payment
        </Button>
      </div>
    </section>
  );
}
