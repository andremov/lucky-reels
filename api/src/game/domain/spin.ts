export const SYMBOLS = ['cherry', 'lemon', 'bell', 'star', 'diamond'] as const;

export type Symbol = (typeof SYMBOLS)[number];

export type SpinOutcome = {
  reels: [Symbol, Symbol, Symbol];
  payout: number;
};

const THREE_OF_A_KIND: Record<Symbol, number> = {
  cherry: 10,
  lemon: 15,
  bell: 25,
  star: 50,
  diamond: 100,
};

const PAIR = 2;

export const SPIN_COST = 1;

export type GameError =
  | { code: 'UNAUTHORIZED'; message: string }
  | { code: 'INSUFFICIENT_CREDITS'; message: string }
  | { code: 'INTERNAL_ERROR'; message: string };

export function payoutFor(reels: [Symbol, Symbol, Symbol]): number {
  const [a, b, c] = reels;

  if (a === b && b === c) return THREE_OF_A_KIND[a];
  if (a === b || b === c || a === c) return PAIR;
  return 0;
}

/**
 * The authoritative spin. The client can ask for one and nothing more; what it
 * renders is an animation of a result decided here. The rng is injected so the
 * outcome is reproducible in tests.
 */
export function resolveSpin(rng: () => number = Math.random): SpinOutcome {
  const pick = (): Symbol => SYMBOLS[Math.floor(rng() * SYMBOLS.length)];
  const reels: [Symbol, Symbol, Symbol] = [pick(), pick(), pick()];

  return { reels, payout: payoutFor(reels) };
}

export const unauthorized = (): GameError => ({
  code: 'UNAUTHORIZED',
  message: 'Missing or unknown player token',
});

export const insufficientCredits = (credits: number): GameError => ({
  code: 'INSUFFICIENT_CREDITS',
  message: `A spin costs ${SPIN_COST} credit and you have ${credits}`,
});

export const gameInternalError = (reason: unknown): GameError => ({
  code: 'INTERNAL_ERROR',
  message: reason instanceof Error ? reason.message : 'Unexpected failure',
});
