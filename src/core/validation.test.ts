/**
 * Validation Module Tests
 *
 * Tests for input validation to prevent NaN, Infinity, and floating-point errors.
 */

import {
  isValidChipAmount,
  isPositiveChipAmount,
  assertValidChipAmount,
  assertPositiveChipAmount,
  validateTableConfig,
  validatePlayerStack,
  sanitizeChipAmount,
  ValidationError,
} from './validation';

describe('isValidChipAmount', () => {
  test('accepts valid non-negative integers', () => {
    expect(isValidChipAmount(0)).toBe(true);
    expect(isValidChipAmount(1)).toBe(true);
    expect(isValidChipAmount(100)).toBe(true);
    expect(isValidChipAmount(1000000)).toBe(true);
  });

  test('rejects NaN', () => {
    expect(isValidChipAmount(NaN)).toBe(false);
  });

  test('rejects Infinity', () => {
    expect(isValidChipAmount(Infinity)).toBe(false);
    expect(isValidChipAmount(-Infinity)).toBe(false);
  });

  test('rejects negative numbers', () => {
    expect(isValidChipAmount(-1)).toBe(false);
    expect(isValidChipAmount(-100)).toBe(false);
  });

  test('rejects non-integers (floats)', () => {
    expect(isValidChipAmount(0.5)).toBe(false);
    expect(isValidChipAmount(10.1)).toBe(false);
    expect(isValidChipAmount(99.99)).toBe(false);
  });

  test('rejects non-numbers', () => {
    expect(isValidChipAmount('100')).toBe(false);
    expect(isValidChipAmount(null)).toBe(false);
    expect(isValidChipAmount(undefined)).toBe(false);
    expect(isValidChipAmount({})).toBe(false);
    expect(isValidChipAmount([])).toBe(false);
  });
});

describe('isPositiveChipAmount', () => {
  test('accepts positive integers', () => {
    expect(isPositiveChipAmount(1)).toBe(true);
    expect(isPositiveChipAmount(100)).toBe(true);
  });

  test('rejects zero', () => {
    expect(isPositiveChipAmount(0)).toBe(false);
  });

  test('rejects invalid values', () => {
    expect(isPositiveChipAmount(-1)).toBe(false);
    expect(isPositiveChipAmount(NaN)).toBe(false);
    expect(isPositiveChipAmount(1.5)).toBe(false);
  });
});

describe('assertValidChipAmount', () => {
  test('does not throw for valid values', () => {
    expect(() => assertValidChipAmount(0, 'test')).not.toThrow();
    expect(() => assertValidChipAmount(100, 'test')).not.toThrow();
  });

  test('throws ValidationError for NaN', () => {
    try {
      assertValidChipAmount(NaN, 'amount');
      fail('Should have thrown');
    } catch (e) {
      const err = e as ValidationError;
      expect(err.code).toBe('INVALID_CHIP_AMOUNT');
      expect(err.field).toBe('amount');
      expect(err.message).toContain('NaN');
    }
  });

  test('throws ValidationError for Infinity', () => {
    try {
      assertValidChipAmount(Infinity, 'bet');
      fail('Should have thrown');
    } catch (e) {
      const err = e as ValidationError;
      expect(err.code).toBe('INVALID_CHIP_AMOUNT');
      expect(err.field).toBe('bet');
      expect(err.message).toContain('Infinity');
    }
  });

  test('throws ValidationError for negative numbers', () => {
    try {
      assertValidChipAmount(-50, 'stack');
      fail('Should have thrown');
    } catch (e) {
      const err = e as ValidationError;
      expect(err.code).toBe('INVALID_CHIP_AMOUNT');
      expect(err.message).toContain('-50');
    }
  });

  test('throws ValidationError for floats', () => {
    try {
      assertValidChipAmount(10.5, 'amount');
      fail('Should have thrown');
    } catch (e) {
      const err = e as ValidationError;
      expect(err.code).toBe('INVALID_CHIP_AMOUNT');
      expect(err.message).toContain('10.5');
    }
  });
});

describe('validateTableConfig', () => {
  test('accepts valid config', () => {
    expect(() => validateTableConfig({
      maxSeats: 6,
      smallBlind: 10,
      bigBlind: 20,
      ante: 0,
    })).not.toThrow();
  });

  test('accepts config with ante', () => {
    expect(() => validateTableConfig({
      maxSeats: 9,
      smallBlind: 50,
      bigBlind: 100,
      ante: 10,
    })).not.toThrow();
  });

  test('rejects invalid maxSeats', () => {
    expect(() => validateTableConfig({
      maxSeats: 1, // Too low
      smallBlind: 10,
      bigBlind: 20,
      ante: 0,
    })).toThrow();

    expect(() => validateTableConfig({
      maxSeats: 11, // Too high
      smallBlind: 10,
      bigBlind: 20,
      ante: 0,
    })).toThrow();

    expect(() => validateTableConfig({
      maxSeats: NaN,
      smallBlind: 10,
      bigBlind: 20,
      ante: 0,
    })).toThrow();
  });

  test('rejects non-integer blinds', () => {
    expect(() => validateTableConfig({
      maxSeats: 6,
      smallBlind: 0.5, // Float!
      bigBlind: 1,
      ante: 0,
    })).toThrow();
  });

  test('rejects BB < SB', () => {
    expect(() => validateTableConfig({
      maxSeats: 6,
      smallBlind: 20,
      bigBlind: 10, // BB < SB
      ante: 0,
    })).toThrow();
  });

  test('rejects NaN in blinds', () => {
    expect(() => validateTableConfig({
      maxSeats: 6,
      smallBlind: NaN,
      bigBlind: 20,
      ante: 0,
    })).toThrow();
  });

  test('rejects negative ante', () => {
    expect(() => validateTableConfig({
      maxSeats: 6,
      smallBlind: 10,
      bigBlind: 20,
      ante: -5,
    })).toThrow();
  });
});

describe('validatePlayerStack', () => {
  test('accepts valid stacks', () => {
    expect(() => validatePlayerStack(1000, 'player1')).not.toThrow();
    expect(() => validatePlayerStack(0, 'player1')).not.toThrow(); // Busted player
  });

  test('rejects NaN', () => {
    expect(() => validatePlayerStack(NaN, 'player1')).toThrow();
  });

  test('rejects negative', () => {
    expect(() => validatePlayerStack(-100, 'player1')).toThrow();
  });

  test('rejects floats', () => {
    expect(() => validatePlayerStack(99.5, 'player1')).toThrow();
  });
});

describe('sanitizeChipAmount', () => {
  test('returns valid integers unchanged', () => {
    expect(sanitizeChipAmount(100)).toBe(100);
    expect(sanitizeChipAmount(0)).toBe(0);
  });

  test('rounds floats to nearest integer', () => {
    expect(sanitizeChipAmount(10.4)).toBe(10);
    expect(sanitizeChipAmount(10.6)).toBe(11);
  });

  test('clamps negative to 0', () => {
    expect(sanitizeChipAmount(-50)).toBe(0);
  });

  test('returns default for NaN', () => {
    expect(sanitizeChipAmount(NaN)).toBe(0);
    expect(sanitizeChipAmount(NaN, 100)).toBe(100);
  });

  test('returns default for Infinity', () => {
    expect(sanitizeChipAmount(Infinity)).toBe(0);
    expect(sanitizeChipAmount(-Infinity, 50)).toBe(50);
  });

  test('returns default for non-numbers', () => {
    expect(sanitizeChipAmount('abc' as any)).toBe(0);
    expect(sanitizeChipAmount(null as any)).toBe(0);
  });
});

describe('Integration: validateAction rejects invalid amounts', () => {
  // These tests verify the integration with the rules module
  const { validateAction, getLegalActionsDetailed } = require('./rules');
  const { createInitialState } = require('./state');

  const createTestConfig = () => ({
    id: 'test-hand',
    players: [
      { id: 'p1', name: 'Player 1', stack: 1000, seat: 0 },
      { id: 'p2', name: 'Player 2', stack: 1000, seat: 1 },
    ],
    tableConfig: {
      maxSeats: 6,
      smallBlind: 10,
      bigBlind: 20,
      ante: 0,
    },
    dealerSeat: 0,
    seed: 12345,
  });

  test('rejects action with NaN amount', () => {
    const state = createInitialState(createTestConfig());

    const action = {
      street: 'preflop',
      playerId: 'p1',
      type: 'raise',
      amount: NaN,
      isAllIn: false,
      timestamp: Date.now(),
    };

    expect(() => validateAction(state, action)).toThrow();
  });

  test('rejects action with Infinity amount', () => {
    const state = createInitialState(createTestConfig());

    const action = {
      street: 'preflop',
      playerId: 'p1',
      type: 'raise',
      amount: Infinity,
      isAllIn: false,
      timestamp: Date.now(),
    };

    expect(() => validateAction(state, action)).toThrow();
  });

  test('rejects action with negative amount', () => {
    const state = createInitialState(createTestConfig());

    const action = {
      street: 'preflop',
      playerId: 'p1',
      type: 'raise',
      amount: -100,
      isAllIn: false,
      timestamp: Date.now(),
    };

    expect(() => validateAction(state, action)).toThrow();
  });

  test('rejects action with float amount', () => {
    const state = createInitialState(createTestConfig());

    const action = {
      street: 'preflop',
      playerId: 'p1',
      type: 'raise',
      amount: 50.5, // Float!
      isAllIn: false,
      timestamp: Date.now(),
    };

    expect(() => validateAction(state, action)).toThrow();
  });

  test('accepts action with valid integer amount', () => {
    const state = createInitialState(createTestConfig());

    // SB acts first in heads-up
    const action = {
      street: 'preflop',
      playerId: 'p1',
      type: 'call',
      amount: 10, // Call the BB (20 - 10 SB = 10)
      isAllIn: false,
      timestamp: Date.now(),
    };

    // Should not throw
    expect(() => validateAction(state, action)).not.toThrow();
  });
});

describe('Integration: createInitialState rejects invalid config', () => {
  const { createInitialState } = require('./state');

  test('rejects config with NaN stack', () => {
    const config = {
      id: 'test-hand',
      players: [
        { id: 'p1', name: 'Player 1', stack: NaN, seat: 0 },
        { id: 'p2', name: 'Player 2', stack: 1000, seat: 1 },
      ],
      tableConfig: {
        maxSeats: 6,
        smallBlind: 10,
        bigBlind: 20,
        ante: 0,
      },
      dealerSeat: 0,
      seed: 12345,
    };

    expect(() => createInitialState(config)).toThrow();
  });

  test('rejects config with float blind', () => {
    const config = {
      id: 'test-hand',
      players: [
        { id: 'p1', name: 'Player 1', stack: 1000, seat: 0 },
        { id: 'p2', name: 'Player 2', stack: 1000, seat: 1 },
      ],
      tableConfig: {
        maxSeats: 6,
        smallBlind: 0.5, // Float!
        bigBlind: 1,
        ante: 0,
      },
      dealerSeat: 0,
      seed: 12345,
    };

    expect(() => createInitialState(config)).toThrow();
  });

  test('rejects config with invalid dealer seat', () => {
    const config = {
      id: 'test-hand',
      players: [
        { id: 'p1', name: 'Player 1', stack: 1000, seat: 0 },
        { id: 'p2', name: 'Player 2', stack: 1000, seat: 1 },
      ],
      tableConfig: {
        maxSeats: 6,
        smallBlind: 10,
        bigBlind: 20,
        ante: 0,
      },
      dealerSeat: NaN,
      seed: 12345,
    };

    expect(() => createInitialState(config)).toThrow();
  });
});
