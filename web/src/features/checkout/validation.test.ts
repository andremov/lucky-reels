import {
  detectBrand,
  isValid,
  luhnValid,
  validateCard,
  validateCustomer,
  validateDelivery,
} from './validation';

const CUSTOMER = { email: 'a@b.co', fullName: 'Someone Real', phone: '+573001234567' };
const DELIVERY = {
  addressLine: 'Calle 1 # 2-3',
  city: 'Bogota',
  region: 'Cundinamarca',
  postalCode: '110111',
};

describe('validateCustomer', () => {
  it('accepts a complete customer', () => {
    expect(isValid(validateCustomer(CUSTOMER))).toBe(true);
  });

  it('flags every missing field at once', () => {
    const errors = validateCustomer({});
    expect(Object.keys(errors).sort()).toEqual([
      'customer.email',
      'customer.fullName',
      'customer.phone',
    ]);
  });

  it('rejects a malformed email', () => {
    expect(validateCustomer({ ...CUSTOMER, email: 'not-an-email' })['customer.email']).toBeDefined();
  });

  it('rejects a whitespace-only name', () => {
    expect(validateCustomer({ ...CUSTOMER, fullName: '   ' })['customer.fullName']).toBeDefined();
  });
});

describe('validateDelivery', () => {
  it('accepts a complete address', () => {
    expect(isValid(validateDelivery(DELIVERY))).toBe(true);
  });

  it('flags each missing address field', () => {
    expect(Object.keys(validateDelivery({}))).toHaveLength(4);
  });
});

describe('luhnValid', () => {
  it.each([
    ['4242424242424242', true],
    ['5555555555554444', true],
    ['378282246310005', true],
    ['4242424242424241', false],
    ['1234', false],
    ['', false],
  ])('checks %s', (number, expected) => {
    expect(luhnValid(number)).toBe(expected);
  });

  it('ignores spaces and dashes', () => {
    expect(luhnValid('4242 4242 4242 4242')).toBe(true);
    expect(luhnValid('4242-4242-4242-4242')).toBe(true);
  });
});

describe('detectBrand', () => {
  it.each([
    ['4242424242424242', 'visa'],
    ['5555555555554444', 'mastercard'],
    ['2223003122003222', 'mastercard'],
    ['378282246310005', 'amex'],
    ['6011111111111117', 'unknown'],
  ])('detects %s', (number, expected) => {
    expect(detectBrand(number)).toBe(expected);
  });
});

describe('validateCard', () => {
  const CARD = {
    cardNumber: '4242424242424242',
    cardHolder: 'Someone Real',
    expiry: '12/30',
    cvv: '123',
  };

  it('accepts a well-formed card', () => {
    expect(isValid(validateCard(CARD))).toBe(true);
  });

  it('rejects a card that fails Luhn', () => {
    expect(validateCard({ ...CARD, cardNumber: '4242424242424241' }).cardNumber).toBeDefined();
  });

  it('requires MM/YY', () => {
    expect(validateCard({ ...CARD, expiry: '2030-12' }).expiry).toBe('Use MM/YY');
  });

  it('rejects an impossible month', () => {
    expect(validateCard({ ...CARD, expiry: '13/30' }).expiry).toBeDefined();
  });

  it('wants 4 CVV digits for amex and 3 otherwise', () => {
    expect(validateCard({ ...CARD, cardNumber: '378282246310005', cvv: '123' }).cvv).toBeDefined();
    expect(
      isValid(validateCard({ ...CARD, cardNumber: '378282246310005', cvv: '1234' })),
    ).toBe(true);
    expect(validateCard({ ...CARD, cvv: '1234' }).cvv).toBeDefined();
  });

  it('flags an empty card', () => {
    expect(Object.keys(validateCard({})).sort()).toEqual([
      'cardHolder',
      'cardNumber',
      'cvv',
      'expiry',
    ]);
  });
});
