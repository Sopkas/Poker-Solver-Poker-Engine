/**
 * Range Manager - Data Structures and Utilities
 *
 * Represents poker hand ranges in a 13x13 matrix format.
 * Each cell represents a hand category with a weight from 0 to 1.
 */

// Ranks ordered from highest (A) to lowest (2)
export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
export type RankChar = typeof RANKS[number];

// Total number of hand combinations in a deck
export const TOTAL_COMBOS = 1326;

/**
 * Range type: Maps hand notation to weight (0-1)
 * Keys: "AA", "AKs", "AKo", etc.
 * Values: 0 (never) to 1 (always)
 */
export type Range = Record<string, number>;

/**
 * Hand category types for visual distinction
 */
export type HandCategory = 'pair' | 'suited' | 'offsuit';

/**
 * Information about a single hand cell in the matrix
 */
export interface HandInfo {
  hand: string;        // e.g., "AA", "AKs", "AKo"
  category: HandCategory;
  combos: number;      // 6 for pairs, 4 for suited, 12 for offsuit
  row: number;         // 0-12 (A-2)
  col: number;         // 0-12 (A-2)
}

/**
 * Get the hand notation for a given row and column
 * Row = first rank, Col = second rank
 * If row < col: suited (top-right triangle)
 * If row > col: offsuit (bottom-left triangle)
 * If row == col: pair (diagonal)
 */
export function getHandNotation(row: number, col: number): string {
  const rank1 = RANKS[row];
  const rank2 = RANKS[col];

  if (row === col) {
    return `${rank1}${rank2}`; // Pair: "AA", "KK", etc.
  } else if (row < col) {
    return `${rank1}${rank2}s`; // Suited: "AKs", "AQs", etc.
  } else {
    return `${rank2}${rank1}o`; // Offsuit: "AKo", "AQo", etc.
  }
}

/**
 * Get the hand category for a given row and column
 */
export function getHandCategory(row: number, col: number): HandCategory {
  if (row === col) return 'pair';
  if (row < col) return 'suited';
  return 'offsuit';
}

/**
 * Count the number of raw combos for a hand type
 * - Pairs: 6 combos (e.g., AA: AsAh, AsAd, AsAc, AhAd, AhAc, AdAc)
 * - Suited: 4 combos (e.g., AKs: AsKs, AhKh, AdKd, AcKc)
 * - Offsuit: 12 combos (e.g., AKo: 4 aces × 4 kings - 4 suited = 12)
 */
export function countCombos(hand: string): number {
  if (hand.length === 2) {
    // Pair
    return 6;
  } else if (hand.endsWith('s')) {
    // Suited
    return 4;
  } else if (hand.endsWith('o')) {
    // Offsuit
    return 12;
  }

  throw new Error(`Invalid hand notation: ${hand}`);
}

/**
 * Count weighted combos for a hand given its weight
 */
export function countWeightedCombos(hand: string, weight: number): number {
  return countCombos(hand) * weight;
}

/**
 * Generate the complete 13x13 matrix of hand information
 */
export function generateHandMatrix(): HandInfo[][] {
  const matrix: HandInfo[][] = [];

  for (let row = 0; row < 13; row++) {
    const rowData: HandInfo[] = [];
    for (let col = 0; col < 13; col++) {
      const hand = getHandNotation(row, col);
      const category = getHandCategory(row, col);
      rowData.push({
        hand,
        category,
        combos: countCombos(hand),
        row,
        col,
      });
    }
    matrix.push(rowData);
  }

  return matrix;
}

/**
 * Get all 169 unique hand notations
 */
export function getAllHands(): string[] {
  const hands: string[] = [];
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      hands.push(getHandNotation(row, col));
    }
  }
  return hands;
}

/**
 * Generate an empty range (all hands at 0%)
 */
export function generateEmptyRange(): Range {
  const range: Range = {};
  for (const hand of getAllHands()) {
    range[hand] = 0;
  }
  return range;
}

/**
 * Generate a full range (all hands at 100%)
 */
export function generateFullRange(): Range {
  const range: Range = {};
  for (const hand of getAllHands()) {
    range[hand] = 1;
  }
  return range;
}

/**
 * Clone a range
 */
export function cloneRange(range: Range): Range {
  return { ...range };
}

/**
 * Calculate range statistics
 */
export interface RangeStats {
  totalCombos: number;      // Weighted combos selected
  totalPercentage: number;  // Percentage of all hands (0-100)
  handsSelected: number;    // Number of hands with weight > 0
}

export function calculateRangeStats(range: Range): RangeStats {
  let totalCombos = 0;
  let handsSelected = 0;

  for (const [hand, weight] of Object.entries(range)) {
    if (weight > 0) {
      totalCombos += countWeightedCombos(hand, weight);
      handsSelected++;
    }
  }

  return {
    totalCombos,
    totalPercentage: (totalCombos / TOTAL_COMBOS) * 100,
    handsSelected,
  };
}

/**
 * Generate a range of top X% of hands (by equity/strength)
 * This is a simplified ordering - a real solver would use actual equity calculations
 */
const HAND_STRENGTH_ORDER = [
  // Tier 1: Premium pairs
  'AA', 'KK', 'QQ', 'JJ', 'TT',
  // Tier 2: Strong suited broadways + pairs
  'AKs', 'AQs', 'AJs', 'KQs', '99', 'ATs', 'AKo', '88',
  // Tier 3: Medium strength
  'KJs', 'QJs', 'JTs', 'AQo', '77', 'KTs', 'QTs', 'AJo', 'KQo',
  // Tier 4: Suited connectors and pairs
  '66', 'T9s', 'A9s', 'A8s', 'K9s', 'KJo', '55', 'A5s', 'A7s', 'A4s', 'A6s', 'A3s',
  'QJo', 'J9s', 'Q9s', 'JTo', 'KTo', 'A2s', '44', '98s', 'T8s', 'K8s', 'K7s',
  // Tier 5: Lower strength
  '33', '22', 'Q8s', 'K6s', '87s', 'QTo', 'K5s', 'K4s', 'K3s', 'K2s', '97s', 'J8s',
  '76s', 'T7s', 'Q7s', 'Q6s', 'Q5s', 'Q4s', 'Q3s', 'Q2s', 'ATo', '65s', '86s',
  'J7s', '96s', '54s', 'J6s', 'J5s', 'J4s', 'J3s', 'J2s', 'A9o', 'K9o',
  // Tier 6: Marginal hands
  '75s', 'T6s', '85s', '64s', 'T5s', 'T4s', 'T3s', 'T2s', '95s', '53s', '74s',
  'Q9o', '94s', '84s', '93s', '43s', 'J9o', '63s', '92s', '73s', '83s', '52s',
  '72s', '62s', '82s', '42s', '32s',
  // Remaining hands (offsuits)
  'T9o', '98o', '87o', '76o', '65o', '54o', 'A8o', 'A7o', 'A6o', 'A5o', 'A4o', 'A3o', 'A2o',
  'K8o', 'K7o', 'K6o', 'K5o', 'K4o', 'K3o', 'K2o',
  'Q8o', 'Q7o', 'Q6o', 'Q5o', 'Q4o', 'Q3o', 'Q2o',
  'J8o', 'J7o', 'J6o', 'J5o', 'J4o', 'J3o', 'J2o',
  'T8o', 'T7o', 'T6o', 'T5o', 'T4o', 'T3o', 'T2o',
  '97o', '96o', '95o', '94o', '93o', '92o',
  '86o', '85o', '84o', '83o', '82o',
  '75o', '74o', '73o', '72o',
  '64o', '63o', '62o',
  '53o', '52o',
  '43o', '42o',
  '32o',
];

/**
 * Generate a range containing approximately the top X% of hands
 */
export function generateTopPercentRange(percentage: number): Range {
  const range = generateEmptyRange();
  const targetCombos = (percentage / 100) * TOTAL_COMBOS;
  let currentCombos = 0;

  for (const hand of HAND_STRENGTH_ORDER) {
    if (currentCombos >= targetCombos) break;

    const handCombos = countCombos(hand);

    // If adding full weight would exceed target, add partial weight
    if (currentCombos + handCombos > targetCombos) {
      const remainingCombos = targetCombos - currentCombos;
      range[hand] = remainingCombos / handCombos;
      currentCombos = targetCombos;
    } else {
      range[hand] = 1;
      currentCombos += handCombos;
    }
  }

  return range;
}

/**
 * Merge two ranges (takes max weight for each hand)
 */
export function mergeRanges(range1: Range, range2: Range): Range {
  const merged = cloneRange(range1);
  for (const [hand, weight] of Object.entries(range2)) {
    merged[hand] = Math.max(merged[hand] || 0, weight);
  }
  return merged;
}

/**
 * Intersect two ranges (takes min weight for each hand)
 */
export function intersectRanges(range1: Range, range2: Range): Range {
  const intersected: Range = {};
  for (const hand of getAllHands()) {
    intersected[hand] = Math.min(range1[hand] || 0, range2[hand] || 0);
  }
  return intersected;
}
