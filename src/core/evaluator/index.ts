/**
 * Hand Evaluator Module
 * 
 * Pure functions for evaluating poker hand strength.
 * Uses bit-shifting scoring for deterministic comparison with proper kicker handling.
 * 
 * Score format: (HandRank << 20) | (Kicker1 << 16) | (Kicker2 << 12) | (Kicker3 << 8) | (Kicker4 << 4) | Kicker5
 * Each kicker uses 4 bits (0-15), supporting ranks 2-14.
 * HandRank uses bits 20-23 (values 1-10 for High Card to Royal Flush).
 */

import { Card, Rank, Suit } from '../types';

// --- Types ---

export type HandRank =
    | 'High Card'
    | 'Pair'
    | 'Two Pair'
    | 'Three of a Kind'
    | 'Straight'
    | 'Flush'
    | 'Full House'
    | 'Four of a Kind'
    | 'Straight Flush'
    | 'Royal Flush';

export interface HandEvaluation {
    rank: HandRank;
    score: number; // Numeric score for comparison (higher is better)
    bestHand: Card[]; // The 5 cards that make the hand
}

// --- Constants ---

const RANK_VALUES: Record<Rank, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const HAND_RANK_VALUES: Record<HandRank, number> = {
    'High Card': 1,
    'Pair': 2,
    'Two Pair': 3,
    'Three of a Kind': 4,
    'Straight': 5,
    'Flush': 6,
    'Full House': 7,
    'Four of a Kind': 8,
    'Straight Flush': 9,
    'Royal Flush': 10
};

// --- Helper Functions ---

/**
 * Generates all k-combinations of an array.
 */
const getCombinations = <T>(arr: T[], k: number): T[][] => {
    if (k === 0) return [[]];
    if (arr.length === 0) return [];

    const [head, ...tail] = arr;
    const withHead = getCombinations(tail, k - 1).map(c => [head, ...c]);
    const withoutHead = getCombinations(tail, k);

    return [...withHead, ...withoutHead];
};

/**
 * Calculates the bit-shifted score for a hand.
 * Format: (HandRank << 20) | (Kicker1 << 16) | (Kicker2 << 12) | ...
 */
const calculateScore = (handRank: HandRank, kickers: number[]): number => {
    let score = HAND_RANK_VALUES[handRank] << 20;

    // Add up to 5 kickers (4 bits each)
    for (let i = 0; i < 5 && i < kickers.length; i++) {
        score |= kickers[i] << (16 - i * 4);
    }

    return score;
};

/**
 * Checks if 5 sorted cards form a straight.
 * Returns the high card value if straight, or 0 if not.
 * Special case: A-5 straight returns 5 (wheel).
 */
const getStraightHighCard = (sortedRanks: number[]): number => {
    // Check normal straight (descending by 1)
    let isStraight = true;
    for (let i = 0; i < 4; i++) {
        if (sortedRanks[i] - sortedRanks[i + 1] !== 1) {
            isStraight = false;
            break;
        }
    }
    if (isStraight) return sortedRanks[0];

    // Check wheel (A-5-4-3-2)
    if (sortedRanks[0] === 14 && sortedRanks[1] === 5 && sortedRanks[2] === 4 &&
        sortedRanks[3] === 3 && sortedRanks[4] === 2) {
        return 5; // 5-high straight
    }

    return 0;
};

/**
 * Evaluates a 5-card hand and returns the evaluation.
 */
const evaluate5 = (cards: Card[]): HandEvaluation => {
    // Sort by rank descending
    const sorted = [...cards].sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]);
    const ranks = sorted.map(c => RANK_VALUES[c.rank]);

    // Check flush
    const isFlush = sorted.every(c => c.suit === sorted[0].suit);

    // Check straight
    const straightHigh = getStraightHighCard(ranks);
    const isStraight = straightHigh > 0;

    // Count rank occurrences
    const rankCounts = new Map<number, number>();
    ranks.forEach(r => rankCounts.set(r, (rankCounts.get(r) || 0) + 1));

    // Sort by count desc, then rank desc
    const sortedCounts = Array.from(rankCounts.entries())
        .sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1]; // Count desc
            return b[0] - a[0]; // Rank desc
        });

    const counts = sortedCounts.map(([, count]) => count);

    // Determine hand rank and kickers
    let rank: HandRank;
    let kickers: number[];

    if (isStraight && isFlush) {
        if (straightHigh === 14) {
            rank = 'Royal Flush';
            kickers = [14]; // All royal flushes are equal
        } else {
            rank = 'Straight Flush';
            kickers = [straightHigh];
        }
    } else if (counts[0] === 4) {
        rank = 'Four of a Kind';
        // Quads rank, then kicker
        const quadsRank = sortedCounts[0][0];
        const kicker = sortedCounts[1][0];
        kickers = [quadsRank, kicker];
    } else if (counts[0] === 3 && counts[1] === 2) {
        rank = 'Full House';
        // Trips rank, then pair rank
        kickers = [sortedCounts[0][0], sortedCounts[1][0]];
    } else if (isFlush) {
        rank = 'Flush';
        kickers = ranks; // All 5 cards matter
    } else if (isStraight) {
        rank = 'Straight';
        kickers = [straightHigh];
    } else if (counts[0] === 3) {
        rank = 'Three of a Kind';
        // Trips rank, then 2 kickers
        const tripsRank = sortedCounts[0][0];
        const remainingKickers = sortedCounts.slice(1).map(([r]) => r).sort((a, b) => b - a);
        kickers = [tripsRank, ...remainingKickers.slice(0, 2)];
    } else if (counts[0] === 2 && counts[1] === 2) {
        rank = 'Two Pair';
        // Higher pair, lower pair, kicker
        const pairs = sortedCounts.filter(([, c]) => c === 2).map(([r]) => r).sort((a, b) => b - a);
        const kicker = sortedCounts.find(([, c]) => c === 1)?.[0] ?? 0;
        kickers = [pairs[0], pairs[1], kicker];
    } else if (counts[0] === 2) {
        rank = 'Pair';
        // Pair rank, then 3 kickers
        const pairRank = sortedCounts[0][0];
        const remainingKickers = sortedCounts.slice(1).map(([r]) => r).sort((a, b) => b - a);
        kickers = [pairRank, ...remainingKickers.slice(0, 3)];
    } else {
        rank = 'High Card';
        kickers = ranks; // All 5 cards matter
    }

    // For wheel straight, reorder cards for display (A at end)
    let bestHand = sorted;
    if ((rank === 'Straight' || rank === 'Straight Flush') && straightHigh === 5) {
        // Move Ace to end for proper display
        const ace = sorted.find(c => c.rank === 'A')!;
        const rest = sorted.filter(c => c.rank !== 'A');
        bestHand = [...rest, ace];
    }

    return {
        rank,
        score: calculateScore(rank, kickers),
        bestHand
    };
};

// --- Public API ---

/**
 * Evaluates a poker hand (5-7 cards) and returns the best 5-card combination.
 * 
 * @param cards - Array of 5 to 7 cards
 * @returns HandEvaluation with rank, score, and best 5-card hand
 * @throws Error if fewer than 5 cards provided
 */
export const evaluate = (cards: Card[]): HandEvaluation => {
    if (cards.length < 5) {
        throw new Error('Need at least 5 cards to evaluate');
    }

    if (cards.length > 7) {
        throw new Error('Cannot evaluate more than 7 cards');
    }

    // Generate all 5-card combinations
    const combos = getCombinations(cards, 5);
    let bestEval: HandEvaluation | null = null;

    for (const combo of combos) {
        const currentEval = evaluate5(combo);
        if (!bestEval || currentEval.score > bestEval.score) {
            bestEval = currentEval;
        }
    }

    if (!bestEval) {
        throw new Error('Failed to evaluate hand');
    }

    return bestEval;
};

/**
 * Gets the numeric score for a hand without full evaluation details.
 * Useful for quick comparisons.
 */
export const getScore = (cards: Card[]): number => {
    return evaluate(cards).score;
};

/**
 * Gets a human-readable description of a hand.
 */
export const getHandName = (evaluation: HandEvaluation): string => {
    const ranks = evaluation.bestHand.map(c => c.rank);

    switch (evaluation.rank) {
        case 'Royal Flush':
            return 'Royal Flush';
        case 'Straight Flush':
            return `Straight Flush, ${ranks[0]}-high`;
        case 'Four of a Kind':
            return `Four of a Kind, ${ranks[0]}s`;
        case 'Full House':
            return `Full House, ${ranks[0]}s full of ${ranks[3]}s`;
        case 'Flush':
            return `Flush, ${ranks[0]}-high`;
        case 'Straight':
            return `Straight, ${ranks[0]}-high`;
        case 'Three of a Kind':
            return `Three of a Kind, ${ranks[0]}s`;
        case 'Two Pair':
            const pairs = [...new Set(ranks.filter((r, i, arr) => arr.indexOf(r) !== arr.lastIndexOf(r)))];
            return `Two Pair, ${pairs[0]}s and ${pairs[1]}s`;
        case 'Pair':
            const pairRank = ranks.find((r, i, arr) => arr.indexOf(r) !== arr.lastIndexOf(r));
            return `Pair of ${pairRank}s`;
        case 'High Card':
            return `High Card, ${ranks[0]}`;
        default:
            return evaluation.rank;
    }
};

// --- Legacy Class Export (for backwards compatibility) ---

export class Evaluator {
    static evaluate(cards: Card[]): HandEvaluation {
        return evaluate(cards);
    }
}
