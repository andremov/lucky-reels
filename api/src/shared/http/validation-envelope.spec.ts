import type { ValidationError } from 'class-validator';
import { flattenValidationErrors, toValidationEnvelope } from './validation-envelope';

const error = (partial: Partial<ValidationError>): ValidationError =>
  ({ property: 'field', ...partial }) as ValidationError;

describe('flattenValidationErrors', () => {
  it('returns nothing for no errors', () => {
    expect(flattenValidationErrors([])).toEqual([]);
  });

  it('reports each constraint on a field', () => {
    const errors = [
      error({ property: 'quantity', constraints: { min: 'too small', isInt: 'not an int' } }),
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      { field: 'quantity', message: 'too small' },
      { field: 'quantity', message: 'not an int' },
    ]);
  });

  it('qualifies nested fields with a dotted path', () => {
    const errors = [
      error({
        property: 'customer',
        children: [error({ property: 'email', constraints: { isEmail: 'must be an email' } })],
      }),
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      { field: 'customer.email', message: 'must be an email' },
    ]);
  });

  it('handles nesting more than one level deep', () => {
    const errors = [
      error({
        property: 'a',
        children: [
          error({ property: 'b', children: [error({ property: 'c', constraints: { x: 'bad' } })] }),
        ],
      }),
    ];

    expect(flattenValidationErrors(errors)).toEqual([{ field: 'a.b.c', message: 'bad' }]);
  });

  it('copes with an error carrying neither constraints nor children', () => {
    expect(flattenValidationErrors([error({ property: 'lonely' })])).toEqual([]);
  });
});

describe('toValidationEnvelope', () => {
  it('produces the documented envelope', () => {
    const exception = toValidationEnvelope([
      error({ property: 'quantity', constraints: { min: 'too small' } }),
    ]);

    expect(exception.getResponse()).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Invalid request',
        details: [{ field: 'quantity', message: 'too small' }],
      },
    });
  });

  it('is a 400', () => {
    expect(toValidationEnvelope([]).getStatus()).toBe(400);
  });
});
