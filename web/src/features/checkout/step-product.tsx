import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { loadProducts, productSelected, stepChanged } from './checkout-slice';
import { formatCents } from './money';
import { Button, ErrorNote } from './ui';

export default function StepProduct() {
  const dispatch = useAppDispatch();
  const { products, productsStatus, selectedProductId, error } = useAppSelector((s) => s.checkout);

  // Refetched on every visit: stock moves as other people reserve and release.
  useEffect(() => {
    dispatch(loadProducts());
  }, [dispatch]);

  const selected = products.find((p) => p.id === selectedProductId);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Pick a pack</h2>

      {productsStatus === 'loading' ? <p className="text-white/60">Loading packs…</p> : null}
      {productsStatus === 'failed' && error ? <ErrorNote>{error.message}</ErrorNote> : null}

      <ul className="flex flex-col gap-3">
        {products.map((product) => {
          const soldOut = product.stock.available < 1;
          const isSelected = product.id === selectedProductId;
          return (
            <li key={product.id}>
              <button
                type="button"
                disabled={soldOut}
                aria-pressed={isSelected}
                onClick={() => dispatch(productSelected({ productId: product.id }))}
                className={`flex w-full items-center justify-between gap-4 rounded-xl border p-4 text-left transition disabled:opacity-40 ${
                  isSelected ? 'border-gold bg-gold/10' : 'border-case-edge hover:border-gold/50'
                }`}
              >
                <span className="flex flex-col">
                  <span className="font-semibold">{product.name}</span>
                  <span className="text-sm text-white/60">{product.description}</span>
                  <span className="text-xs text-white/50">
                    {soldOut ? 'Sold out' : `${product.stock.available} available`}
                  </span>
                </span>
                <span className="shrink-0 font-semibold text-gold">
                  {formatCents(product.priceCents, product.currency)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Button disabled={!selected} onClick={() => dispatch(stepChanged('details'))}>
        Continue
      </Button>
    </section>
  );
}
