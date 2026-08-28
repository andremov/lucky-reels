import type { Customer, Delivery } from './checkout-types';

const KEY = 'lucky-reels.checkout.v1';

/**
 * What survives a refresh. Deliberately excludes card number, CVV and the
 * payment token — the contract forbids persisting those, and they live in
 * component state only.
 */
export type PersistedCheckout = {
  reference: string | null;
  reservedFor?: { productId: string; quantity: number } | null;
  step: number;
  productId: string | null;
  quantity: number;
  customer: Partial<Customer>;
  delivery: Partial<Delivery>;
  playerToken?: string | null;
};

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // Private mode / blocked site data.
  }
}

export function loadCheckout(storage: Storage | null = defaultStorage()): PersistedCheckout | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCheckout;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed;
  } catch {
    return null; // Corrupt payload beats a crash on boot.
  }
}

export function saveCheckout(
  state: PersistedCheckout,
  storage: Storage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Quota or blocked storage: resume is a convenience, not a requirement.
  }
}

export function clearCheckout(storage: Storage | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(KEY);
  } catch {
    // ignore
  }
}
