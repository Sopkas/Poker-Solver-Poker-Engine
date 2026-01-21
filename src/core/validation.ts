/**
 * Validation Module - Input Sanitization
 *
 * Ensures all numeric inputs are valid integers to prevent
 * floating-point precision errors and NaN/Infinity corruption.
 *
 * IMPORTANT: All chip amounts should be integers (cents/pennies).
 * If blinds are $10/$20, config should use 1000/2000 (cents).
 */

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  value?: unknown;
}

/**
 * Checks if a value is a valid chip amount (non-negative integer).
 * Returns false for: NaN, Infinity, negative, non-integer, non-number.
 */
export function isValidChipAmount(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

/**
 * Checks if a value is a valid positive chip amount (positive integer > 0).
 */
export function isPositiveChipAmount(value: unknown): value is number {
  return isValidChipAmount(value) && value > 0;
}

/**
 * Asserts that a value is a valid chip amount.
 * Throws ValidationError if invalid.
 */
export function assertValidChipAmount(
  value: unknown,
  fieldName: string
): asserts value is number {
  if (!isValidChipAmount(value)) {
    throw {
      code: 'INVALID_CHIP_AMOUNT',
      message: `${fieldName} must be a non-negative integer. Got: ${formatValue(value)}`,
      field: fieldName,
      value,
    } as ValidationError;
  }
}

/**
 * Asserts that a value is a positive chip amount (> 0).
 * Throws ValidationError if invalid.
 */
export function assertPositiveChipAmount(
  value: unknown,
  fieldName: string
): asserts value is number {
  if (!isPositiveChipAmount(value)) {
    throw {
      code: 'INVALID_CHIP_AMOUNT',
      message: `${fieldName} must be a positive integer. Got: ${formatValue(value)}`,
      field: fieldName,
      value,
    } as ValidationError;
  }
}

/**
 * Asserts that a value is a valid seat index (0 to maxSeats-1).
 */
export function assertValidSeatIndex(
  value: unknown,
  maxSeats: number,
  fieldName: string
): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value >= maxSeats
  ) {
    throw {
      code: 'INVALID_SEAT_INDEX',
      message: `${fieldName} must be an integer between 0 and ${maxSeats - 1}. Got: ${formatValue(value)}`,
      field: fieldName,
      value,
    } as ValidationError;
  }
}

/**
 * Validates all chip-related fields in an action.
 * Call this before processing any action.
 */
export function validateActionAmount(amount: unknown, fieldName: string = 'amount'): void {
  assertValidChipAmount(amount, fieldName);
}

/**
 * Validates table configuration values.
 */
export function validateTableConfig(config: {
  maxSeats: unknown;
  smallBlind: unknown;
  bigBlind: unknown;
  ante: unknown;
}): void {
  // maxSeats must be a positive integer
  if (
    typeof config.maxSeats !== 'number' ||
    !Number.isInteger(config.maxSeats) ||
    config.maxSeats < 2 ||
    config.maxSeats > 10
  ) {
    throw {
      code: 'INVALID_CONFIG',
      message: `maxSeats must be an integer between 2 and 10. Got: ${formatValue(config.maxSeats)}`,
      field: 'maxSeats',
      value: config.maxSeats,
    } as ValidationError;
  }

  assertPositiveChipAmount(config.smallBlind, 'smallBlind');
  assertPositiveChipAmount(config.bigBlind, 'bigBlind');
  assertValidChipAmount(config.ante, 'ante'); // ante can be 0

  // BB should be >= SB
  if ((config.bigBlind as number) < (config.smallBlind as number)) {
    throw {
      code: 'INVALID_CONFIG',
      message: `bigBlind (${config.bigBlind}) must be >= smallBlind (${config.smallBlind})`,
      field: 'bigBlind',
      value: config.bigBlind,
    } as ValidationError;
  }
}

/**
 * Validates player stack configuration.
 */
export function validatePlayerStack(stack: unknown, playerId: string): void {
  if (!isValidChipAmount(stack)) {
    throw {
      code: 'INVALID_PLAYER_STACK',
      message: `Player ${playerId} stack must be a non-negative integer. Got: ${formatValue(stack)}`,
      field: 'stack',
      value: stack,
    } as ValidationError;
  }
}

/**
 * Formats a value for error messages.
 */
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'NaN';
    if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity';
    return String(value);
  }
  return String(value);
}

/**
 * Sanitizes a chip amount by rounding and clamping.
 * Use this ONLY for display/UI purposes, never for game logic.
 *
 * @param value - The value to sanitize
 * @param defaultValue - Value to return if input is invalid
 * @returns Sanitized integer >= 0
 */
export function sanitizeChipAmount(value: unknown, defaultValue: number = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return defaultValue;
  }
  return Math.max(0, Math.round(value));
}
