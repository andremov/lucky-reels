export type ProductError =
  | { code: 'PRODUCT_NOT_FOUND'; message: string }
  | { code: 'INTERNAL_ERROR'; message: string };

export type Product = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: 'COP';
  imageUrl: string;
  spinsGranted: number;
};

export type ProductView = Product & {
  stock: { available: number };
};

export const productNotFound = (id: string): ProductError => ({
  code: 'PRODUCT_NOT_FOUND',
  message: `No product with id ${id}`,
});

export const internalError = (reason: unknown): ProductError => ({
  code: 'INTERNAL_ERROR',
  message: reason instanceof Error ? reason.message : 'Unexpected failure',
});

export const toProductView = (
  product: Product,
  stock: { available: number },
): ProductView => ({ ...product, stock: { available: stock.available } });
