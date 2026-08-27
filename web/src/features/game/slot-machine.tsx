import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { spinRequested, spinResolved } from './game-slice';
import { resolveSpin, SPIN_COST, type Spin } from './spin';
import Reel from './reel';

const BASE_SPIN_MS = 900;
const REEL_STAGGER_MS = 260;

const reelDuration = (index: number) => BASE_SPIN_MS + index * REEL_STAGGER_MS;
const TOTAL_SPIN_MS = reelDuration(2);

export default function SlotMachine() {
  const dispatch = useAppDispatch();
  const { credits, reels, status, lastPayout } = useAppSelector((s) => s.game);
  const [pending, setPending] = useState<Spin | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const spinning = status === 'spinning';
  const canSpin = !spinning && credits >= SPIN_COST;

  const handleSpin = () => {
    if (!canSpin) return;

    const outcome = resolveSpin();
    setPending(outcome);
    dispatch(spinRequested());

    timer.current = window.setTimeout(() => {
      dispatch(spinResolved(outcome));
      setPending(null);
    }, TOTAL_SPIN_MS);
  };

  const shown = pending?.reels ?? reels;

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border border-case-edge bg-case p-5">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-normal uppercase tracking-widest text-gold">Lucky Reels</h1>
        <p className="flex flex-col items-end gap-0.5">
          <span className="text-[0.625rem] uppercase tracking-widest text-white/45">Credits</span>
          <span className="text-2xl leading-none tabular-nums">{credits}</span>
        </p>
      </header>

      <div className="relative grid grid-cols-3 gap-1.5 rounded-md border-2 border-gold-dim bg-window p-1.5">
        {shown.map((symbol, i) => (
          <Reel key={i} target={symbol} spinning={spinning} durationMs={reelDuration(i)} />
        ))}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1.5 top-1/2 h-cell -translate-y-1/2 border-y border-gold/35"
        />
      </div>

      <p className="min-h-5 text-center text-sm text-white/70" role="status" aria-live="polite">
        {spinning
          ? 'Spinning...'
          : lastPayout === null
            ? 'Pull to play'
            : lastPayout > 0
              ? `You won ${lastPayout} credits`
              : 'No win'}
      </p>

      <button
        className="rounded-md bg-gold px-4 py-3.5 font-bold tracking-wide text-[#241a0e] hover:bg-[#f7cd69] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-gold"
        onClick={handleSpin}
        disabled={!canSpin}
      >
        {credits < SPIN_COST ? 'Out of credits' : `Spin (${SPIN_COST})`}
      </button>
    </section>
  );
}
