import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { ChargeInput, ChargeOutcome, PaymentGateway } from '../domain/payment-gateway';

/**
 * Deliberately anchored rather than substring matched. A provider token id looks
 * like `tok_stagtest_5113_B2Ff...`, which contains the substring "ok" — every
 * token does, because `tok_` contains it. Matching on substrings would approve
 * real tokens by accident, which is the failure this strictness exists to stop.
 */
const OUTCOME_PATTERNS: [RegExp, 'APPROVED' | 'DECLINED' | 'ERROR'][] = [
  [/^tok_stagtest_ok_/, 'APPROVED'],
  [/^tok_stagtest_decline_/, 'DECLINED'],
  [/^tok_stagtest_error_/, 'ERROR'],
  [/^tok_ok$/, 'APPROVED'],
  [/^tok_approve$/, 'APPROVED'],
  [/^tok_decline$/, 'DECLINED'],
  [/^tok_error$/, 'ERROR'],
];

/**
 * Stand-in for the provider. The token decides the outcome, so a reviewer can
 * force any branch on demand. A token it does not recognise is an ERROR rather
 * than an approval: if a real provider token ever reaches the stub, that is a
 * misconfiguration and it must be visible, not settle as a successful payment.
 */
@Injectable()
export class StubGateway implements PaymentGateway {
  charge(input: ChargeInput): Promise<ChargeOutcome> {
    const id = `stub_${randomBytes(6).toString('hex')}`;
    const matched = OUTCOME_PATTERNS.find(([pattern]) => pattern.test(input.paymentToken));

    if (!matched) {
      return Promise.resolve({
        result: 'ERROR',
        reason: 'Unrecognised stub token. The stub gateway is bound but the token is not one of its own.',
      });
    }

    switch (matched[1]) {
      case 'APPROVED':
        return Promise.resolve({ result: 'APPROVED', gatewayTransactionId: id });
      case 'DECLINED':
        return Promise.resolve({
          result: 'DECLINED',
          gatewayTransactionId: id,
          reason: 'Card declined by issuer',
        });
      default:
        return Promise.resolve({ result: 'ERROR', reason: 'Gateway unavailable' });
    }
  }
}
