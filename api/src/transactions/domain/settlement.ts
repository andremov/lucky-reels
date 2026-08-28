import type { ChargeOutcome } from '../../payments/domain/payment-gateway';
import type { TransactionStatus } from './transaction';

export type Settlement = {
  status: TransactionStatus;
  /** Approved sales consume the reservation; anything else hands it back. */
  stockMove: 'commit' | 'release';
  creditsGranted: number | null;
  issuePlayerToken: boolean;
  gatewayTransactionId: string | null;
};

/**
 * What a gateway outcome means for the order. Kept separate from the database
 * work so the rules are readable and testable without a connection.
 */
export function planSettlement(
  outcome: ChargeOutcome,
  quantity: number,
  spinsGranted: number,
): Settlement {
  const gatewayTransactionId =
    'gatewayTransactionId' in outcome ? outcome.gatewayTransactionId : null;

  if (outcome.result === 'APPROVED') {
    return {
      status: 'APPROVED',
      stockMove: 'commit',
      creditsGranted: spinsGranted * quantity,
      issuePlayerToken: true,
      gatewayTransactionId,
    };
  }

  return {
    status: outcome.result,
    stockMove: 'release',
    creditsGranted: null,
    issuePlayerToken: false,
    gatewayTransactionId,
  };
}
