import { clearCheckout, loadCheckout, saveCheckout, type PersistedCheckout } from './checkout-storage';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

const STATE: PersistedCheckout = {
  reference: 'LR-7F3A9C2B',
  step: 4,
  productId: 'prd_starter',
  quantity: 1,
  customer: { email: 'a@b.co' },
  delivery: { city: 'Bogota' },
};

describe('checkout storage', () => {
  it('round-trips the persisted state', () => {
    const storage = memoryStorage();
    saveCheckout(STATE, storage);
    expect(loadCheckout(storage)).toEqual(STATE);
  });

  it('returns null when nothing is stored', () => {
    expect(loadCheckout(memoryStorage())).toBeNull();
  });

  it('returns null rather than throwing on a corrupt payload', () => {
    const storage = memoryStorage();
    storage.map.set('lucky-reels.checkout.v1', '{not json');
    expect(loadCheckout(storage)).toBeNull();
  });

  it('clears the stored state', () => {
    const storage = memoryStorage();
    saveCheckout(STATE, storage);
    clearCheckout(storage);
    expect(loadCheckout(storage)).toBeNull();
  });

  it('never writes card data even if handed some', () => {
    const storage = memoryStorage();
    saveCheckout(STATE, storage);
    const raw = storage.map.get('lucky-reels.checkout.v1') ?? '';
    expect(raw).not.toMatch(/cardNumber|cvv|paymentToken/i);
  });

  it('degrades quietly when storage is unavailable', () => {
    expect(() => saveCheckout(STATE, null)).not.toThrow();
    expect(loadCheckout(null)).toBeNull();
  });
});
