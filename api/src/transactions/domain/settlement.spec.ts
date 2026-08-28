import { planSettlement } from './settlement';

const approved = { result: 'APPROVED', gatewayTransactionId: 'g1' } as const;
const declined = { result: 'DECLINED', gatewayTransactionId: 'g2', reason: 'no' } as const;
const errored = { result: 'ERROR', reason: 'upstream down' } as const;

describe('planSettlement', () => {
  describe('approved', () => {
    it('consumes the reservation rather than handing it back', () => {
      expect(planSettlement(approved, 1, 20).stockMove).toBe('commit');
    });

    it('grants one pack of spins per unit bought', () => {
      expect(planSettlement(approved, 3, 20).creditsGranted).toBe(60);
    });

    it('issues a player token so the buyer can spend the credits', () => {
      expect(planSettlement(approved, 1, 20).issuePlayerToken).toBe(true);
    });

    it('keeps the gateway id for tracing the charge', () => {
      expect(planSettlement(approved, 1, 20).gatewayTransactionId).toBe('g1');
    });

    it('assigns the goods for delivery', () => {
      expect(planSettlement(approved, 1, 20).deliveryStatus).toBe('ASSIGNED');
    });
  });

  describe('declined', () => {
    it('hands the reservation back so someone else can buy it', () => {
      expect(planSettlement(declined, 1, 20).stockMove).toBe('release');
    });

    it('grants nothing', () => {
      expect(planSettlement(declined, 1, 20).creditsGranted).toBeNull();
    });

    it('issues no player token', () => {
      expect(planSettlement(declined, 1, 20).issuePlayerToken).toBe(false);
    });

    it('still records the gateway id, since the attempt happened', () => {
      expect(planSettlement(declined, 1, 20).gatewayTransactionId).toBe('g2');
    });

    it('carries the status through', () => {
      expect(planSettlement(declined, 1, 20).status).toBe('DECLINED');
    });

    it('assigns nothing for delivery', () => {
      expect(planSettlement(declined, 1, 20).deliveryStatus).toBe('PENDING');
    });
  });

  describe('gateway error', () => {
    it('releases the reservation, since no sale happened', () => {
      expect(planSettlement(errored, 1, 20).stockMove).toBe('release');
    });

    it('has no gateway id to record', () => {
      expect(planSettlement(errored, 1, 20).gatewayTransactionId).toBeNull();
    });

    it('is ERROR rather than DECLINED, because the card was never judged', () => {
      expect(planSettlement(errored, 1, 20).status).toBe('ERROR');
    });

    it('grants nothing', () => {
      expect(planSettlement(errored, 1, 20).creditsGranted).toBeNull();
    });

    it('assigns nothing for delivery', () => {
      expect(planSettlement(errored, 1, 20).deliveryStatus).toBe('PENDING');
    });
  });

  it('never grants credits without also issuing a token to spend them', () => {
    for (const outcome of [approved, declined, errored] as const) {
      const plan = planSettlement(outcome, 2, 20);
      expect(plan.creditsGranted !== null).toBe(plan.issuePlayerToken);
    }
  });

  it('assigns delivery exactly when it commits stock', () => {
    for (const outcome of [approved, declined, errored] as const) {
      const plan = planSettlement(outcome, 1, 20);
      expect(plan.deliveryStatus === 'ASSIGNED').toBe(plan.stockMove === 'commit');
    }
  });

  it('only ever commits stock on an approval', () => {
    for (const outcome of [declined, errored] as const) {
      expect(planSettlement(outcome, 1, 20).stockMove).toBe('release');
    }
    expect(planSettlement(approved, 1, 20).stockMove).toBe('commit');
  });
});
