import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  hydrated,
  persist,
  refreshTransaction,
  STEPS,
  stepIndex,
  type Step,
} from './checkout-slice';
import { loadCheckout } from './checkout-storage';
import StepProduct from './step-product';
import StepDetails from './step-details';
import StepSummary from './step-summary';
import StepPayment from './step-payment';
import StepResult from './step-result';

const LABELS: Record<Step, string> = {
  product: 'Pack',
  details: 'Details',
  summary: 'Review',
  payment: 'Payment',
  result: 'Done',
};

function Stepper({ current }: { current: Step }) {
  const currentIndex = stepIndex(current);
  return (
    <ol className="flex items-center justify-between gap-1 text-xs" aria-label="Checkout progress">
      {STEPS.map((step, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
        return (
          <li
            key={step}
            aria-current={state === 'current' ? 'step' : undefined}
            className={`flex-1 border-t-2 pt-2 ${
              state === 'todo' ? 'border-case-edge text-white/40' : 'border-gold text-white'
            }`}
          >
            {index + 1}. {LABELS[step]}
          </li>
        );
      })}
    </ol>
  );
}

export default function CheckoutWizard() {
  const dispatch = useAppDispatch();
  const checkout = useAppSelector((s) => s.checkout);
  const restored = useRef(false);

  // On load, a stored reference is the source of truth: ask the API what
  // actually happened rather than trusting the step we left off on.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;

    const saved = loadCheckout();
    if (!saved) return;

    dispatch(
      hydrated({
        selectedProductId: saved.productId,
        quantity: saved.quantity ?? 1,
        customer: saved.customer ?? {},
        delivery: saved.delivery ?? {},
        reference: saved.reference,
        playerToken: saved.playerToken ?? null,
        step: saved.reference ? 'result' : (STEPS[saved.step] ?? 'product'),
      }),
    );

    if (saved.reference) dispatch(refreshTransaction(saved.reference));
  }, [dispatch]);

  useEffect(() => {
    persist(checkout);
  }, [checkout]);

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-xl border border-case-edge bg-case p-5">
      <h1 className="text-xl font-bold text-gold">Checkout</h1>
      <Stepper current={checkout.step} />

      {checkout.step === 'product' ? <StepProduct /> : null}
      {checkout.step === 'details' ? <StepDetails /> : null}
      {checkout.step === 'summary' ? <StepSummary /> : null}
      {checkout.step === 'payment' ? <StepPayment /> : null}
      {checkout.step === 'result' ? <StepResult /> : null}
    </section>
  );
}
