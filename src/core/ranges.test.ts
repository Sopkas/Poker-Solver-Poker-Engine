import {
  countCombos,
  countWeightedCombos,
  generateEmptyRange,
  generateFullRange,
  calculateRangeStats,
  TOTAL_COMBOS,
  getHandNotation,
  getHandCategory,
} from './ranges';

describe('Range Manager - Data Structures & Combinatorics', () => {
  describe('countCombos', () => {
    test('pairs have 6 combos', () => {
      expect(countCombos('AA')).toBe(6);
      expect(countCombos('KK')).toBe(6);
      expect(countCombos('22')).toBe(6);
    });

    test('suited hands have 4 combos', () => {
      expect(countCombos('AKs')).toBe(4);
      expect(countCombos('T9s')).toBe(4);
      expect(countCombos('32s')).toBe(4);
    });

    test('offsuit hands have 12 combos', () => {
      expect(countCombos('AKo')).toBe(12);
      expect(countCombos('T9o')).toBe(12);
      expect(countCombos('32o')).toBe(12);
    });
  });

  describe('countWeightedCombos', () => {
    test('full weight returns raw combos', () => {
      expect(countWeightedCombos('AA', 1)).toBe(6);
      expect(countWeightedCombos('AKs', 1)).toBe(4);
      expect(countWeightedCombos('AKo', 1)).toBe(12);
    });

    test('50% weight returns half combos', () => {
      expect(countWeightedCombos('KK', 0.5)).toBe(3);
      expect(countWeightedCombos('AKs', 0.5)).toBe(2);
      expect(countWeightedCombos('AKo', 0.5)).toBe(6);
    });

    test('0% weight returns 0 combos', () => {
      expect(countWeightedCombos('AA', 0)).toBe(0);
    });
  });

  describe('getHandNotation', () => {
    test('diagonal cells are pairs', () => {
      expect(getHandNotation(0, 0)).toBe('AA');
      expect(getHandNotation(1, 1)).toBe('KK');
      expect(getHandNotation(12, 12)).toBe('22');
    });

    test('top-right triangle is suited', () => {
      expect(getHandNotation(0, 1)).toBe('AKs');
      expect(getHandNotation(0, 2)).toBe('AQs');
      expect(getHandNotation(1, 2)).toBe('KQs');
    });

    test('bottom-left triangle is offsuit', () => {
      expect(getHandNotation(1, 0)).toBe('AKo');
      expect(getHandNotation(2, 0)).toBe('AQo');
      expect(getHandNotation(2, 1)).toBe('KQo');
    });
  });

  describe('getHandCategory', () => {
    test('identifies pairs on diagonal', () => {
      expect(getHandCategory(0, 0)).toBe('pair');
      expect(getHandCategory(5, 5)).toBe('pair');
    });

    test('identifies suited in top-right', () => {
      expect(getHandCategory(0, 1)).toBe('suited');
      expect(getHandCategory(3, 7)).toBe('suited');
    });

    test('identifies offsuit in bottom-left', () => {
      expect(getHandCategory(1, 0)).toBe('offsuit');
      expect(getHandCategory(7, 3)).toBe('offsuit');
    });
  });

  describe('calculateRangeStats', () => {
    test('empty range has 0 combos', () => {
      const range = generateEmptyRange();
      const stats = calculateRangeStats(range);
      expect(stats.totalCombos).toBe(0);
      expect(stats.totalPercentage).toBe(0);
      expect(stats.handsSelected).toBe(0);
    });

    test('full range has 1326 combos (100%)', () => {
      const range = generateFullRange();
      const stats = calculateRangeStats(range);
      expect(stats.totalCombos).toBe(TOTAL_COMBOS);
      expect(stats.totalPercentage).toBeCloseTo(100, 2);
      expect(stats.handsSelected).toBe(169);
    });

    // Verification test case 1: Select "AA"
    test('selecting AA shows 6 combos (0.45%)', () => {
      const range = generateEmptyRange();
      range['AA'] = 1;
      const stats = calculateRangeStats(range);
      expect(stats.totalCombos).toBe(6);
      expect(stats.totalPercentage).toBeCloseTo((6 / 1326) * 100, 2);
      expect(stats.handsSelected).toBe(1);
    });

    // Verification test case 2: Add "AKs" to "AA"
    test('selecting AA + AKs shows 10 combos', () => {
      const range = generateEmptyRange();
      range['AA'] = 1;
      range['AKs'] = 1;
      const stats = calculateRangeStats(range);
      expect(stats.totalCombos).toBe(10); // 6 + 4
      expect(stats.handsSelected).toBe(2);
    });

    // Verification test case 3: KK at 50% weight adds 3 combos
    test('KK at 50% weight adds 3 combos', () => {
      const range = generateEmptyRange();
      range['KK'] = 0.5;
      const stats = calculateRangeStats(range);
      expect(stats.totalCombos).toBe(3); // 50% of 6
      expect(stats.handsSelected).toBe(1);
    });

    // Combined test: AA + AKs + 50% KK
    test('AA + AKs + 50% KK = 13 combos', () => {
      const range = generateEmptyRange();
      range['AA'] = 1;
      range['AKs'] = 1;
      range['KK'] = 0.5;
      const stats = calculateRangeStats(range);
      expect(stats.totalCombos).toBe(13); // 6 + 4 + 3
      expect(stats.handsSelected).toBe(3);
    });
  });

  describe('matrix dimensions', () => {
    test('matrix is 169 cells (13x13)', () => {
      const range = generateEmptyRange();
      const hands = Object.keys(range);
      expect(hands.length).toBe(169);
    });

    test('total combos sum to 1326', () => {
      const range = generateEmptyRange();
      const hands = Object.keys(range);
      const totalRawCombos = hands.reduce((sum, hand) => sum + countCombos(hand), 0);
      expect(totalRawCombos).toBe(1326);
    });

    test('there are 13 pairs, 78 suited, 78 offsuit', () => {
      const range = generateEmptyRange();
      const hands = Object.keys(range);

      const pairs = hands.filter(h => h.length === 2);
      const suited = hands.filter(h => h.endsWith('s'));
      const offsuit = hands.filter(h => h.endsWith('o'));

      expect(pairs.length).toBe(13);
      expect(suited.length).toBe(78);
      expect(offsuit.length).toBe(78);
    });
  });
});
