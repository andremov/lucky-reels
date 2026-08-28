import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { creditsAdded } from '@/features/game/game-slice';
import { checkoutReset, pollingTimedOut, refreshTransaction } from './checkout-slice';
import AmountsTable from './amounts-table';
import { Button } from './ui';

export const POLL_INTERVAL_MS = 2000;
export const POLL_TIMEOUT_MS = 60000;

export default function StepResult() {
  const dispatch = useAppDispatch();
  const { status, reference, amounts, transaction, polling, pollTimedOut } = useAppSelector(
    (s) => s.checkout,
  );
  const granted = useRef(false);

  // Poll until the gateway decides, then give up quietly — the webhook may
  // still land, so a timeout is not a failure.
  useEffect(() => {
    if (!polling || !reference) return;

    // Ask once straight away — the outcome is often already in by the time the
    // customer lands here, and waiting a full interval to show it reads as a hang.
    dispatch(refreshTransaction(undefined));

    const interval = window.setInterval(() => {
      dispatch(refreshTransaction(undefined));
    }, POLL_INTERVAL_MS);
    const timeout = window.setTimeout(() => dispatch(pollingTimedOut()), POLL_TIMEOUT_MS);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [dispatch, polling, reference]);

  // Credits are granted by the server; the game store just mirrors them once.
  useEffect(() => {
    if (status === 'APPROVED' && transaction?.creditsGranted && !granted.current) {
      granted.current = true;
      dispatch(creditsAdded(transaction.creditsGranted));
    }
  }, [dispatch, status, transaction?.creditsGranted]);

  const pending = status === 'PENDING' || status === null;

  return (
    <section className="flex flex-col gap-4 text-center">
      {pending ? (
        <>
          <h2 className="text-lg font-semibold">
            {pollTimedOut ? 'Still processing' : 'Confirming your payment…'}
          </h2>
          <p className="text-sm text-white/60">
            {pollTimedOut
              ? 'This is taking longer than usual. We will email you as soon as it settles.'
              : 'Hold on while the bank decides. Do not close this page.'}
          </p>
        </>
      ) : null}

      {status === 'APPROVED' ? (
        <>
          <h2 className="text-lg font-semibold text-gold">Payment approved</h2>
          <p className="text-sm text-white/70">
            {transaction?.creditsGranted} spins added to your machine.
          </p>
        </>
      ) : null}

      {status === 'DECLINED' ? (
        <>
          <h2 className="text-lg font-semibold text-red-400">Payment declined</h2>
          <p className="text-sm text-white/60">
            The bank refused the card. Nothing was charged and your packs were released.
          </p>
        </>
      ) : null}

      {status === 'ERROR' ? (
        <>
          <h2 className="text-lg font-semibold text-red-400">Something went wrong</h2>
          <p className="text-sm text-white/60">
            We could not complete the payment. Nothing was charged.
          </p>
        </>
      ) : null}

      {reference ? (
        <p className="text-xs text-white/50">
          Reference <span className="font-mono text-white/80">{reference}</span>
        </p>
      ) : null}

      {amounts ? <AmountsTable amounts={amounts} /> : null}

      {!pending ? (
        <Button onClick={() => dispatch(checkoutReset())}>
          {status === 'APPROVED' ? 'Back to the machine' : 'Try again'}
        </Button>
      ) : null}
    </section>
  );
}
