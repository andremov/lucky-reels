import type { Customer, Delivery } from './checkout-types';

export type Errors = Record<string, string>;

// Deliberately permissive: the server is the authority and returns
// VALIDATION_FAILED with field detail. This only catches obvious mistakes
// before spending a round trip.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d ()-]{7,20}$/;

export function validateCustomer(customer: Partial<Customer>): Errors {
  const errors: Errors = {};
  if (!customer.fullName?.trim()) errors['customer.fullName'] = 'Enter your full name';
  if (!customer.email?.trim()) errors['customer.email'] = 'Enter your email';
  else if (!EMAIL.test(customer.email)) errors['customer.email'] = 'That email looks wrong';
  if (!customer.phone?.trim()) errors['customer.phone'] = 'Enter your phone number';
  else if (!PHONE.test(customer.phone)) errors['customer.phone'] = 'That phone looks wrong';
  return errors;
}

export function validateDelivery(delivery: Partial<Delivery>): Errors {
  const errors: Errors = {};
  if (!delivery.addressLine?.trim()) errors['delivery.addressLine'] = 'Enter your address';
  if (!delivery.city?.trim()) errors['delivery.city'] = 'Enter your city';
  if (!delivery.region?.trim()) errors['delivery.region'] = 'Enter your region';
  if (!delivery.postalCode?.trim()) errors['delivery.postalCode'] = 'Enter your postal code';
  return errors;
}

export function validateDetails(
  customer: Partial<Customer>,
  delivery: Partial<Delivery>,
): Errors {
  return { ...validateCustomer(customer), ...validateDelivery(delivery) };
}

/** Luhn, so an obviously mistyped card never reaches the gateway. */
export function luhnValid(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let value = digits.charCodeAt(i) - 48;
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'unknown';

export function detectBrand(cardNumber: string): CardBrand {
  const digits = cardNumber.replace(/\D/g, '');
  if (/^4/.test(digits)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'mastercard';
  if (/^3[47]/.test(digits)) return 'amex';
  return 'unknown';
}

export type CardDraft = {
  cardNumber: string;
  cardHolder: string;
  expiry: string;
  cvv: string;
};

export function validateCard(card: Partial<CardDraft>): Errors {
  const errors: Errors = {};

  if (!card.cardNumber?.trim()) errors.cardNumber = 'Enter the card number';
  else if (!luhnValid(card.cardNumber)) errors.cardNumber = 'That card number is not valid';

  if (!card.cardHolder?.trim()) errors.cardHolder = 'Enter the name on the card';

  const expiry = card.expiry?.trim() ?? '';
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(expiry);
  if (!expiry) {
    errors.expiry = 'Enter the expiry date';
  } else if (!match) {
    errors.expiry = 'Use MM/YY';
  } else {
    const month = Number(match[1]);
    if (month < 1 || month > 12) errors.expiry = 'That month is not valid';
  }

  const cvv = card.cvv?.trim() ?? '';
  const cvvLength = detectBrand(card.cardNumber ?? '') === 'amex' ? 4 : 3;
  if (!cvv) errors.cvv = 'Enter the CVV';
  else if (!new RegExp(`^\\d{${cvvLength}}$`).test(cvv)) errors.cvv = `CVV must be ${cvvLength} digits`;

  return errors;
}

export const isValid = (errors: Errors) => Object.keys(errors).length === 0;
