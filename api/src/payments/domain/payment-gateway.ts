export type ChargeInput = {
  reference: string;
  amountCents: number;
  currency: 'COP';
  paymentToken: string;
  installments: number;
};

export type ChargeOutcome =
  | { result: 'APPROVED'; gatewayTransactionId: string }
  | { result: 'DECLINED'; gatewayTransactionId: string; reason: string }
  | { result: 'ERROR'; reason: string };

/**
 * The port the domain talks to. No vendor appears in this file, so swapping
 * providers means writing one adapter.
 */
export interface PaymentGateway {
  charge(input: ChargeInput): Promise<ChargeOutcome>;
}

export const PAYMENT_GATEWAY = Symbol('PaymentGateway');
