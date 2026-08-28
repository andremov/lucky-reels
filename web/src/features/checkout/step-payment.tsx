import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { payTransaction, stepChanged } from './checkout-slice';
import { detectBrand, isValid, validateCard, type CardDraft, type Errors } from './validation';
import AmountsTable from './amounts-table';
import { Button, ErrorNote, Field } from './ui';

const EMPTY: CardDraft = { cardNumber: '', cardHolder: '', expiry: '', cvv: '' };

const BRAND_LABEL: Record<string, string> = {
  visa: 'VISA',
  mastercard: 'Mastercard',
  amex: 'Amex',
  unknown: '',
};

export default function StepPayment() {
  const dispatch = useAppDispatch();
  const { amounts, reference, submitting, error } = useAppSelector((s) => s.checkout);

  // Card data lives here and dies with this component. It is never dispatched
  // into the store and never persisted.
  const [card, setCard] = useState<CardDraft>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});

  const brand = detectBrand(card.cardNumber);
  const set = (patch: Partial<CardDraft>) => setCard((prev) => ({ ...prev, ...patch }));

  const handlePay = () => {
    const found = validateCard(card);
    setErrors(found);
    if (!isValid(found)) return;

    // The real gateway tokenises in the browser; the card never reaches our API.
    const paymentToken = `tok_stagtest_${brand}_${card.cardNumber.slice(-4)}`;
    setCard(EMPTY);
    dispatch(
      payTransaction({ paymentToken, acceptanceToken: 'acc_stub', installments: 1 }),
    );
  };

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Payment</h2>

      {reference ? (
        <p className="text-xs text-white/50">
          Reference <span className="font-mono text-white/80">{reference}</span>
        </p>
      ) : null}

      {amounts ? <AmountsTable amounts={amounts} /> : null}

      <div className="flex flex-col gap-3">
        <Field
          label={`Card number${brand !== 'unknown' ? ` (${BRAND_LABEL[brand]})` : ''}`}
          name="cardNumber"
          inputMode="numeric"
          autoComplete="cc-number"
          value={card.cardNumber}
          error={errors.cardNumber}
          onChange={(e) => set({ cardNumber: e.target.value })}
        />
        <Field
          label="Name on card"
          name="cardHolder"
          autoComplete="cc-name"
          value={card.cardHolder}
          error={errors.cardHolder}
          onChange={(e) => set({ cardHolder: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Expiry (MM/YY)"
            name="expiry"
            placeholder="12/30"
            autoComplete="cc-exp"
            value={card.expiry}
            error={errors.expiry}
            onChange={(e) => set({ expiry: e.target.value })}
          />
          <Field
            label="CVV"
            name="cvv"
            inputMode="numeric"
            autoComplete="cc-csc"
            value={card.cvv}
            error={errors.cvv}
            onChange={(e) => set({ cvv: e.target.value })}
          />
        </div>
      </div>

      {error ? <ErrorNote>{error.message}</ErrorNote> : null}

      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => dispatch(stepChanged('summary'))}>
          Back
        </Button>
        <Button disabled={submitting} onClick={handlePay}>
          {submitting ? 'Sending…' : amounts ? 'Pay now' : 'Pay'}
        </Button>
      </div>
    </section>
  );
}
