import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

export type FieldError = { field: string; message: string };

export function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => ({ field, message }));

    return [...own, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

export function toValidationEnvelope(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    error: {
      code: 'VALIDATION_FAILED',
      message: 'Invalid request',
      details: flattenValidationErrors(errors),
    },
  });
}
