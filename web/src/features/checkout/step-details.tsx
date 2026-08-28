import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { createTransaction, customerChanged, deliveryChanged } from './checkout-slice';
import { stepChanged } from './checkout-slice';
import { isValid, validateDetails, type Errors } from './validation';
import { Button, ErrorNote, Field } from './ui';

export default function StepDetails() {
  const dispatch = useAppDispatch();
  const { customer, delivery, error, submitting, reference, reservedFor, selectedProductId, quantity } =
    useAppSelector((s) => s.checkout);
  const [errors, setErrors] = useState<Errors>({});

  // The API reports field errors with the same dotted paths this form uses
  // ("customer.email"), so a server rejection lands on the offending input
  // rather than as an opaque banner.
  const serverErrors: Errors = {};
  if (error?.code === 'VALIDATION_FAILED') {
    for (const detail of error.details) serverErrors[detail.field] = detail.message;
  }
  const shown: Errors = { ...serverErrors, ...errors };

  const handleContinue = () => {
    const found = validateDetails(customer, delivery);
    setErrors(found);
    if (!isValid(found)) return;

    const alreadyReserved =
      reference !== null &&
      reservedFor !== null &&
      reservedFor.productId === selectedProductId &&
      reservedFor.quantity === quantity;

    if (alreadyReserved) {
      // Came back to edit and nothing about the order changed: reuse the
      // existing reservation rather than taking a second one.
      dispatch(stepChanged('summary'));
      return;
    }

    // Reserves stock and returns the server-computed fees the summary needs.
    dispatch(createTransaction());
  };

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Where should it go?</h2>

      <div className="flex flex-col gap-3">
        <Field
          label="Full name"
          name="fullName"
          value={customer.fullName ?? ''}
          error={shown['customer.fullName']}
          onChange={(e) => dispatch(customerChanged({ fullName: e.target.value }))}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          value={customer.email ?? ''}
          error={shown['customer.email']}
          onChange={(e) => dispatch(customerChanged({ email: e.target.value }))}
        />
        <Field
          label="Phone"
          name="phone"
          value={customer.phone ?? ''}
          error={shown['customer.phone']}
          onChange={(e) => dispatch(customerChanged({ phone: e.target.value }))}
        />
        <Field
          label="Address"
          name="addressLine"
          value={delivery.addressLine ?? ''}
          error={shown['delivery.addressLine']}
          onChange={(e) => dispatch(deliveryChanged({ addressLine: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="City"
            name="city"
            value={delivery.city ?? ''}
            error={shown['delivery.city']}
            onChange={(e) => dispatch(deliveryChanged({ city: e.target.value }))}
          />
          <Field
            label="Region"
            name="region"
            value={delivery.region ?? ''}
            error={shown['delivery.region']}
            onChange={(e) => dispatch(deliveryChanged({ region: e.target.value }))}
          />
        </div>
        <Field
          label="Postal code"
          name="postalCode"
          value={delivery.postalCode ?? ''}
          error={shown['delivery.postalCode']}
          onChange={(e) => dispatch(deliveryChanged({ postalCode: e.target.value }))}
        />
      </div>

      {/* Reserving happens here now, so refusals like OUT_OF_STOCK surface on
          this step. Field-level problems are shown on the inputs instead. */}
      {error && error.code !== 'VALIDATION_FAILED' ? <ErrorNote>{error.message}</ErrorNote> : null}

      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => dispatch(stepChanged('product'))}>
          Back
        </Button>
        <Button disabled={submitting} onClick={handleContinue}>
          {submitting ? 'Reserving…' : 'Review order'}
        </Button>
      </div>
    </section>
  );
}
