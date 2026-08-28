import { err, ok, type Result } from '../../shared/result/result';

export type StockError =
  | { code: 'INVALID_QUANTITY'; message: string }
  | { code: 'OUT_OF_STOCK'; message: string; available: number }
  | { code: 'RESERVATION_TOO_LARGE'; message: string; reserved: number };

export type StockSnapshot = {
  productId: string;
  available: number;
  reserved: number;
};

export class Stock {
  private constructor(
    readonly productId: string,
    readonly available: number,
    readonly reserved: number,
  ) {}

  static from({ productId, available, reserved }: StockSnapshot): Stock {
    return new Stock(productId, available, reserved);
  }

  reserve(quantity: number): Result<Stock, StockError> {
    if (!isPositiveInteger(quantity)) return err(invalidQuantity(quantity));

    if (quantity > this.available) {
      return err({
        code: 'OUT_OF_STOCK',
        message: `Only ${this.available} left`,
        available: this.available,
      });
    }

    return ok(new Stock(this.productId, this.available - quantity, this.reserved + quantity));
  }

  commit(quantity: number): Result<Stock, StockError> {
    if (!isPositiveInteger(quantity)) return err(invalidQuantity(quantity));
    if (quantity > this.reserved) return err(reservationTooLarge(quantity, this.reserved));

    return ok(new Stock(this.productId, this.available, this.reserved - quantity));
  }

  release(quantity: number): Result<Stock, StockError> {
    if (!isPositiveInteger(quantity)) return err(invalidQuantity(quantity));
    if (quantity > this.reserved) return err(reservationTooLarge(quantity, this.reserved));

    return ok(new Stock(this.productId, this.available + quantity, this.reserved - quantity));
  }

  get total(): number {
    return this.available + this.reserved;
  }

  toSnapshot(): StockSnapshot {
    return { productId: this.productId, available: this.available, reserved: this.reserved };
  }
}

const isPositiveInteger = (n: number) => Number.isInteger(n) && n > 0;

const invalidQuantity = (quantity: number): StockError => ({
  code: 'INVALID_QUANTITY',
  message: `Quantity must be a positive whole number, got ${quantity}`,
});

const reservationTooLarge = (quantity: number, reserved: number): StockError => ({
  code: 'RESERVATION_TOO_LARGE',
  message: `Cannot settle ${quantity} against ${reserved} reserved`,
  reserved,
});
