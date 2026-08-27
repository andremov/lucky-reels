export const SYMBOLS = ['cherry', 'lemon', 'bell', 'star', 'diamond'] as const;

export type Symbol = (typeof SYMBOLS)[number];

export type Spin = {
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

export function payoutFor(reels: [Symbol, Symbol, Symbol]): number {
  const [a, b, c] = reels;

  if (a === b && b === c) return THREE_OF_A_KIND[a];
  if (a === b || b === c || a === c) return PAIR;
  return 0;
}

// rng is injected so tests are deterministic and this can move to the backend
// unchanged. Outcomes must not be decided by the client in production.
export function resolveSpin(rng: () => number = Math.random): Spin {
  const pick = (): Symbol => SYMBOLS[Math.floor(rng() * SYMBOLS.length)];
  const reels: [Symbol, Symbol, Symbol] = [pick(), pick(), pick()];

  return { reels, payout: payoutFor(reels) };
}
