import { createHash } from 'node:crypto';
import type { ChargeInput, ChargeOutcome, PaymentGateway } from '../domain/payment-gateway';

export type LiveGatewayConfig = {
  apiUrl: string;
  publicKey: string;
  privateKey: string;
  integrityKey: string;
};

export type LiveGatewayDeps = {
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export const POLL_INTERVAL_MS = 750;
export const POLL_BUDGET_MS = 12_000;

/** Their vocabulary is wider than ours. Anything unrecognised is not a success. */
export function mapStatus(providerStatus: string): 'APPROVED' | 'DECLINED' | 'ERROR' | 'PENDING' {
  switch (providerStatus) {
    case 'APPROVED':
      return 'APPROVED';
    case 'DECLINED':
      return 'DECLINED';
    case 'PENDING':
      return 'PENDING';
    // A void is a reversal, not a refusal. Calling it DECLINED would tell the
    // customer their card was refused, which is untrue and sends them looking
    // for another card. Both release the reservation, so this is about what the
    // customer is told.
    case 'VOIDED':
    case 'ERROR':
    default:
      return 'ERROR';
  }
}

export function signature(
  reference: string,
  amountCents: number,
  currency: string,
  integrityKey: string,
): string {
  return createHash('sha256')
    .update(`${reference}${amountCents}${currency}${integrityKey}`)
    .digest('hex');
}

export class GatewayTimeoutError extends Error {
  constructor(reference: string) {
    super(`Gateway did not settle ${reference} within ${POLL_BUDGET_MS}ms`);
    this.name = 'GatewayTimeoutError';
  }
}

export class GatewayUnavailableError extends Error {
  constructor(detail: string) {
    super(`Gateway unavailable: ${detail}`);
    this.name = 'GatewayUnavailableError';
  }
}

export class LiveGateway implements PaymentGateway {
  private readonly http: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly config: LiveGatewayConfig,
    deps: LiveGatewayDeps = {},
  ) {
    this.http = deps.fetch ?? fetch;
    this.now = deps.now ?? Date.now;
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async charge(input: ChargeInput): Promise<ChargeOutcome> {
    const acceptanceToken = await this.acceptanceToken();
    const id = await this.createTransaction(input, acceptanceToken);

    return this.pollUntilTerminal(id, input.reference);
  }

  /**
   * Fetched fresh for every charge. The token is single use: reusing one gets
   * "El token de aceptación ya fue usado" and the transaction is refused before
   * the card is considered, so a cache would let only the first payment of a
   * process ever succeed.
   */
  private async acceptanceToken(): Promise<string> {
    const response = await this.http(`${this.config.apiUrl}/merchants/${this.config.publicKey}`);
    if (!response.ok) {
      throw new GatewayUnavailableError(`merchant lookup returned ${response.status}`);
    }

    const body = (await response.json()) as {
      data?: { presigned_acceptance?: { acceptance_token?: string } };
    };
    const token = body.data?.presigned_acceptance?.acceptance_token;
    if (!token) throw new GatewayUnavailableError('merchant lookup returned no acceptance token');

    return token;
  }

  private async createTransaction(input: ChargeInput, acceptanceToken: string): Promise<string> {
    const response = await this.http(`${this.config.apiUrl}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.privateKey}`,
      },
      body: JSON.stringify({
        amount_in_cents: input.amountCents,
        currency: input.currency,
        customer_email: input.customerEmail,
        reference: input.reference,
        acceptance_token: acceptanceToken,
        signature: signature(
          input.reference,
          input.amountCents,
          input.currency,
          this.config.integrityKey,
        ),
        payment_method: {
          type: 'CARD',
          token: input.paymentToken,
          installments: input.installments,
        },
      }),
    });

    const body = (await response.json()) as { data?: { id?: string }; error?: unknown };
    const id = body.data?.id;

    if (!id) {
      throw new GatewayUnavailableError(
        `transaction rejected with ${response.status}: ${JSON.stringify(body.error ?? body).slice(0, 200)}`,
      );
    }

    return id;
  }

  /**
   * Throws on timeout rather than returning an outcome. Every ChargeOutcome is
   * terminal and moves stock, so guessing one here would either release stock on
   * a payment that may yet approve, or grant credits for one that never lands.
   * Throwing leaves the transaction PENDING with its stock reserved, which is
   * the truthful state: we do not know.
   */
  private async pollUntilTerminal(id: string, reference: string): Promise<ChargeOutcome> {
    const deadline = this.now() + POLL_BUDGET_MS;

    while (this.now() < deadline) {
      await this.sleep(POLL_INTERVAL_MS);

      const response = await this.http(`${this.config.apiUrl}/transactions/${id}`, {
        headers: { Authorization: `Bearer ${this.config.privateKey}` },
      });
      const body = (await response.json()) as {
        data?: { status?: string; status_message?: string };
      };
      const status = mapStatus(body.data?.status ?? '');

      if (status === 'APPROVED') return { result: 'APPROVED', gatewayTransactionId: id };
      if (status === 'DECLINED') {
        return {
          result: 'DECLINED',
          gatewayTransactionId: id,
          reason: body.data?.status_message ?? 'Declined by the issuer',
        };
      }
      if (status === 'ERROR') {
        return { result: 'ERROR', reason: body.data?.status_message ?? 'Payment did not complete' };
      }
    }

    throw new GatewayTimeoutError(reference);
  }
}
