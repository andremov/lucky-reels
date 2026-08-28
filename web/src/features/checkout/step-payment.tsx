import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { payTransaction, stepChanged } from './checkout-slice';
import { detectBrand, isValid, validateCard, type CardDraft, type Errors } from './validation';
import { TokenizationError } from './card-tokenizer';
import { useTokenizer } from './tokenizer-context';
import AmountsTable from './amounts-table';
import Modal from './modal';
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
  const [open, setOpen] = useState(false);
  const [tokenizing, setTokenizing] = useState(false);
  const tokenizer = useTokenizer();

  const brand = detectBrand(card.cardNumber);
  const set = (patch: Partial<CardDraft>) => setCard((prev) => ({ ...prev, ...patch }));

  const closeModal = () => {
    setOpen(false);
    setErrors({});
    setCard(EMPTY); // Card details do not outlive the modal.
  };

  const handlePay = async () => {
    const found = validateCard(card);
    setErrors(found);
    if (!isValid(found)) return;

    // Tokenised in the browser, so the card number never reaches our API.
    setTokenizing(true);
    let paymentToken: string;
    try {
      paymentToken = await tokenizer.tokenize(card);
    } catch (error) {
      setTokenizing(false);
      if (error instanceof TokenizationError) {
        // The provider rejects specific fields; show it on the input it belongs
        // to rather than as a dead end the customer cannot act on.
        setErrors(
          Object.keys(error.fieldErrors).length > 0
            ? error.fieldErrors
            : { cardNumber: error.message },
        );
        return;
      }
      setErrors({ cardNumber: 'Could not verify these card details. Please try again.' });
      return;
    }

    setTokenizing(false);
    setCard(EMPTY);
    setOpen(false);
    dispatch(payTransaction({ paymentToken, installments: 1 }));
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

      {error ? <ErrorNote>{error.message}</ErrorNote> : null}

      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => dispatch(stepChanged('summary'))}>
          Back
        </Button>
        <Button disabled={submitting} onClick={() => setOpen(true)}>
          {submitting ? 'Sending…' : 'Pay with credit card'}
        </Button>
      </div>

      {open ? (
        <Modal title="Card details" onClose={closeModal}>
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

            {amounts ? (
              <p className="text-sm text-white/60">
                You are paying the total shown behind this dialog.
              </p>
            ) : null}

            <div className="mt-1 flex gap-2">
              <Button variant="ghost" onClick={closeModal}>
                Cancel
              </Button>
              <Button disabled={submitting || tokenizing} onClick={handlePay}>
                {tokenizing ? 'Checking card…' : submitting ? 'Sending…' : 'Pay now'}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
