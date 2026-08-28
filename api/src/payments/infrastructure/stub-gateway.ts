import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { ChargeInput, ChargeOutcome, PaymentGateway } from '../domain/payment-gateway';

/**
 * Deterministic stand-in for the real provider. The outcome is decided by the
 * token so a reviewer can force any branch on demand:
 *
 *   a token containing "decline" -> DECLINED
 *   a token containing "error"   -> ERROR
 *   anything else                -> APPROVED
 *
 * A stub that approves everything looks like nothing is being checked, which is
 * the opposite of what this is for.
 */
@Injectable()
export class StubGateway implements PaymentGateway {
  charge(input: ChargeInput): Promise<ChargeOutcome> {
    const token = input.paymentToken.toLowerCase();
    const id = `stub_${randomBytes(6).toString('hex')}`;

    if (token.includes('error')) {
      return Promise.resolve({ result: 'ERROR', reason: 'Gateway unavailable' });
    }

    if (token.includes('decline')) {
      return Promise.resolve({
        result: 'DECLINED',
        gatewayTransactionId: id,
        reason: 'Card declined by issuer',
      });
    }

    return Promise.resolve({ result: 'APPROVED', gatewayTransactionId: id });
  }
}
