import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { customerChanged, deliveryChanged, stepChanged } from './checkout-slice';
import { isValid, validateDetails, type Errors } from './validation';
import { Button, Field } from './ui';

export default function StepDetails() {
  const dispatch = useAppDispatch();
  const { customer, delivery } = useAppSelector((s) => s.checkout);
  const [errors, setErrors] = useState<Errors>({});

  const handleContinue = () => {
    const found = validateDetails(customer, delivery);
    setErrors(found);
    if (isValid(found)) dispatch(stepChanged('summary'));
  };

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Where should it go?</h2>

      <div className="flex flex-col gap-3">
        <Field
          label="Full name"
          name="fullName"
          value={customer.fullName ?? ''}
          error={errors['customer.fullName']}
          onChange={(e) => dispatch(customerChanged({ fullName: e.target.value }))}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          value={customer.email ?? ''}
          error={errors['customer.email']}
          onChange={(e) => dispatch(customerChanged({ email: e.target.value }))}
        />
        <Field
          label="Phone"
          name="phone"
          value={customer.phone ?? ''}
          error={errors['customer.phone']}
          onChange={(e) => dispatch(customerChanged({ phone: e.target.value }))}
        />
        <Field
          label="Address"
          name="addressLine"
          value={delivery.addressLine ?? ''}
          error={errors['delivery.addressLine']}
          onChange={(e) => dispatch(deliveryChanged({ addressLine: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="City"
            name="city"
            value={delivery.city ?? ''}
            error={errors['delivery.city']}
            onChange={(e) => dispatch(deliveryChanged({ city: e.target.value }))}
          />
          <Field
            label="Region"
            name="region"
            value={delivery.region ?? ''}
            error={errors['delivery.region']}
            onChange={(e) => dispatch(deliveryChanged({ region: e.target.value }))}
          />
        </div>
        <Field
          label="Postal code"
          name="postalCode"
          value={delivery.postalCode ?? ''}
          error={errors['delivery.postalCode']}
          onChange={(e) => dispatch(deliveryChanged({ postalCode: e.target.value }))}
        />
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => dispatch(stepChanged('product'))}>
          Back
        </Button>
        <Button onClick={handleContinue}>Review order</Button>
      </div>
    </section>
  );
}
