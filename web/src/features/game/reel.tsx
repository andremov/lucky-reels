import { useEffect, useState } from 'react';
import { SYMBOLS, type Symbol } from './spin';
import { SYMBOL_GLYPH, SYMBOL_LABEL } from './symbols';

const CYCLES = 6;
const STRIP: Symbol[] = Array.from({ length: CYCLES + 2 }, () => SYMBOLS).flat();

export const CELL_PX = 64;

const landingIndex = (target: Symbol) => CYCLES * SYMBOLS.length + SYMBOLS.indexOf(target);

type Props = {
  target: Symbol;
  spinning: boolean;
  durationMs: number;
};

export default function Reel({ target, spinning, durationMs }: Props) {
  const [phase, setPhase] = useState<'rest' | 'reset' | 'run'>('rest');

  useEffect(() => {
    if (!spinning) return;

    // Two steps on purpose: in one the browser coalesces both style changes and
    // nothing moves.
    setPhase('reset');
    const frame = requestAnimationFrame(() => setPhase('run'));

    return () => cancelAnimationFrame(frame);
  }, [spinning]);

  const offset = phase === 'reset' ? 0 : landingIndex(target) - 1;

  return (
    <div
      className="h-[calc(3*var(--spacing-cell))] overflow-hidden rounded-sm bg-reel"
      role="img"
      aria-label={SYMBOL_LABEL[target]}
    >
      <div
        className="flex flex-col ease-[cubic-bezier(0.15,0.85,0.25,1)] transition-transform motion-reduce:transition-none"
        data-testid="reel-strip"
        style={{
          transform: `translateY(${-offset * CELL_PX}px)`,
          transitionDuration: phase === 'run' ? `${durationMs}ms` : '0ms',
        }}
      >
        {STRIP.map((symbol, i) => (
          <div
            className="flex h-cell shrink-0 items-center justify-center text-3xl leading-none"
            key={i}
            aria-hidden="true"
          >
            {SYMBOL_GLYPH[symbol]}
          </div>
        ))}
      </div>
    </div>
  );
}
