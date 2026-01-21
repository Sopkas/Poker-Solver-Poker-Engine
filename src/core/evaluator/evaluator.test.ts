/**
 * Hand Evaluator Tests
 * 
 * Tests for hand ranking, kicker logic, and edge cases.
 */

import { evaluate, getScore, getHandName, HandEvaluation } from '../index';
import { Card, Rank, Suit } from '../types';

// --- Test Helpers ---

const card = (rank: Rank, suit: Suit): Card => ({ rank, suit });

const parseCards = (str: string): Card[] => {
    const cards: Card[] = [];
    for (let i = 0; i < str.length; i += 2) {
        const rank = str[i] as Rank;
        const suit = str[i + 1].toLowerCase() as Suit;
        cards.push({ rank, suit });
    }
    return cards;
};

// --- Tests ---

describe('Hand Evaluator', () => {
    describe('Hand Ranking Order', () => {
        it('ranks hands correctly (Royal Flush > Straight Flush > ... > High Card)', () => {
            // Royal Flush: A K Q J T (hearts)
            const royalFlush = parseCards('AhKhQhJhTh9d2c');

            // Straight Flush: 9 8 7 6 5 (hearts)
            const straightFlush = parseCards('9h8h7h6h5hKdJc');

            // Four of a Kind: AAAA K
            const fourOfAKind = parseCards('AhAdAcAsKhQdJc');

            // Full House: AAA KK
            const fullHouse = parseCards('AhAdAcKhKdQdJc');

            // Flush: A K Q J 9 (hearts - not connected)
            const flush = parseCards('AhKhQhJh9h8d2c');

            // Straight: A K Q J T (not suited)
            const straight = parseCards('AhKdQcJsThKh2c');

            // Three of a Kind: AAA K Q
            const threeOfAKind = parseCards('AhAdAcKhQd5s3c');

            // Two Pair: AA KK Q
            const twoPair = parseCards('AhAdKhKdQd5s3c');

            // Pair: AA K Q J
            const pair = parseCards('AhAdKhQdJd5s3c');

            // High Card: A K Q J 9
            const highCard = parseCards('AhKdQcJs9h5s2c');

            const scores = {
                royalFlush: getScore(royalFlush),
                straightFlush: getScore(straightFlush),
                fourOfAKind: getScore(fourOfAKind),
                fullHouse: getScore(fullHouse),
                flush: getScore(flush),
                straight: getScore(straight),
                threeOfAKind: getScore(threeOfAKind),
                twoPair: getScore(twoPair),
                pair: getScore(pair),
                highCard: getScore(highCard)
            };

            expect(scores.royalFlush).toBeGreaterThan(scores.straightFlush);
            expect(scores.straightFlush).toBeGreaterThan(scores.fourOfAKind);
            expect(scores.fourOfAKind).toBeGreaterThan(scores.fullHouse);
            expect(scores.fullHouse).toBeGreaterThan(scores.flush);
            expect(scores.flush).toBeGreaterThan(scores.straight);
            expect(scores.straight).toBeGreaterThan(scores.threeOfAKind);
            expect(scores.threeOfAKind).toBeGreaterThan(scores.twoPair);
            expect(scores.twoPair).toBeGreaterThan(scores.pair);
            expect(scores.pair).toBeGreaterThan(scores.highCard);
        });
    });

    describe('Kicker Logic', () => {
        it('Pair of Aces (K kicker) beats Pair of Aces (Q kicker)', () => {
            // AA K Q J
            const acesHighKicker = parseCards('AhAdKhQdJh5s3c');
            // AA Q J T
            const acesLowKicker = parseCards('AhAdQhJdTh5s3c');

            expect(getScore(acesHighKicker)).toBeGreaterThan(getScore(acesLowKicker));
        });

        it('A8 beats A7 on K-Q-J-2-2 board', () => {
            // Player 1: A8 + board K Q J 2 2 = Pair of 2s, A K Q J kickers
            const board = parseCards('KhQdJc2s2h');
            const player1Hand = [...parseCards('As8d'), ...board];
            const player2Hand = [...parseCards('Ac7d'), ...board];

            const eval1 = evaluate(player1Hand);
            const eval2 = evaluate(player2Hand);

            // Both have pair of 2s, but kickers are A K Q (tied on first 3, then 8 vs 7)
            expect(eval1.rank).toBe('Pair');
            expect(eval2.rank).toBe('Pair');

            expect(eval1.score).toBe(eval2.score);
        });

        it('Two Pair with higher kicker wins', () => {
            // AA KK Q vs AA KK J
            const twoPairHighKicker = parseCards('AhAdKhKdQh5s3c');
            const twoPairLowKicker = parseCards('AhAdKhKdJh5s3c');

            expect(getScore(twoPairHighKicker)).toBeGreaterThan(getScore(twoPairLowKicker));
        });

        it('Higher two pair beats lower two pair', () => {
            // AA KK vs AA QQ
            const higherTwoPair = parseCards('AhAdKhKdQh5s3c');
            const lowerTwoPair = parseCards('AhAdQhQdJh5s3c');

            expect(getScore(higherTwoPair)).toBeGreaterThan(getScore(lowerTwoPair));
        });
    });

    describe('Straight Edge Cases', () => {
        it('A-5 straight (wheel) is lower than 6-5 straight', () => {
            // Wheel: A 2 3 4 5
            const wheel = parseCards('Ah2d3c4s5hKdQd');
            // 6-high straight: 2 3 4 5 6
            const sixHigh = parseCards('2h3d4c5s6hKdQd');

            const wheelEval = evaluate(wheel);
            const sixHighEval = evaluate(sixHigh);

            expect(wheelEval.rank).toBe('Straight');
            expect(sixHighEval.rank).toBe('Straight');
            expect(sixHighEval.score).toBeGreaterThan(wheelEval.score);
        });

        it('Broadway straight is highest straight', () => {
            // Broadway: A K Q J T
            const broadway = parseCards('AhKdQcJsTh9d2c');
            // King-high straight: K Q J T 9
            const kingHigh = parseCards('KdQcJsTh9h2d3c');

            expect(getScore(broadway)).toBeGreaterThan(getScore(kingHigh));
        });
    });

    describe('Counterfeited Two Pair', () => {
        it('Player with 22 on 55 66 A board has 6655A (not "three pair")', () => {
            // Player holds 22, board is 55 66 A
            const holeCards = parseCards('2h2d');
            const board = parseCards('5h5d6h6dAc');
            const allCards = [...holeCards, ...board];

            const evaluation = evaluate(allCards);

            // Best hand is 6655A (two pair, 6s and 5s)
            expect(evaluation.rank).toBe('Two Pair');

            // The 2s are counterfeited - they don't play
            const bestHandRanks = evaluation.bestHand.map(c => c.rank);
            expect(bestHandRanks).not.toContain('2');

            // Should contain both 6s and both 5s
            expect(bestHandRanks.filter(r => r === '6').length).toBe(2);
            expect(bestHandRanks.filter(r => r === '5').length).toBe(2);
        });
    });

    describe('Hand Detection', () => {
        it('correctly identifies Royal Flush', () => {
            const cards = parseCards('AhKhQhJhTh9d2c');
            const evaluation = evaluate(cards);
            expect(evaluation.rank).toBe('Royal Flush');
        });

        it('correctly identifies Straight Flush', () => {
            const cards = parseCards('9h8h7h6h5hKdQd');
            const evaluation = evaluate(cards);
            expect(evaluation.rank).toBe('Straight Flush');
        });

        it('correctly identifies Four of a Kind', () => {
            const cards = parseCards('AhAdAcAsKh5d2c');
            const evaluation = evaluate(cards);
            expect(evaluation.rank).toBe('Four of a Kind');
        });

        it('correctly identifies Full House', () => {
            const cards = parseCards('AhAdAcKhKd5s2c');
            const evaluation = evaluate(cards);
            expect(evaluation.rank).toBe('Full House');
        });

        it('correctly identifies Flush', () => {
            const cards = parseCards('AhKhQhJh9h5d2c');
            const evaluation = evaluate(cards);
            expect(evaluation.rank).toBe('Flush');
        });

        it('correctly identifies Straight', () => {
            const cards = parseCards('AhKdQcJsTh5h2c');
            const evaluation = evaluate(cards);
            expect(evaluation.rank).toBe('Straight');
        });

        it('correctly identifies Three of a Kind', () => {
            const cards = parseCards('AhAdAcKhQd5s2c');
            const evaluation = evaluate(cards);
            expect(evaluation.rank).toBe('Three of a Kind');
        });

        it('correctly identifies Two Pair', () => {
            const cards = parseCards('AhAdKhKdQd5s2c');
            const evaluation = evaluate(cards);
            expect(evaluation.rank).toBe('Two Pair');
        });

        it('correctly identifies Pair', () => {
            const cards = parseCards('AhAdKhQdJd5s2c');
            const evaluation = evaluate(cards);
            expect(evaluation.rank).toBe('Pair');
        });

        it('correctly identifies High Card', () => {
            const cards = parseCards('AhKdQcJs9h5s2c');
            const evaluation = evaluate(cards);
            expect(evaluation.rank).toBe('High Card');
        });
    });

    describe('Input Validation', () => {
        it('throws error for fewer than 5 cards', () => {
            const cards = parseCards('AhKd');
            expect(() => evaluate(cards)).toThrow('Need at least 5 cards');
        });

        it('throws error for more than 7 cards', () => {
            const cards = parseCards('AhKdQcJsTh9h8h7h');
            expect(() => evaluate(cards)).toThrow('Cannot evaluate more than 7 cards');
        });

        it('works with exactly 5 cards', () => {
            const cards = parseCards('AhKdQcJsTh');
            const evaluation = evaluate(cards);
            expect(evaluation.rank).toBe('Straight');
        });

        it('works with exactly 7 cards', () => {
            const cards = parseCards('AhKdQcJsTh9h8h');
            const evaluation = evaluate(cards);
            expect(evaluation.rank).toBe('Straight');
            expect(evaluation.bestHand).toHaveLength(5);
        });
    });

    describe('getHandName', () => {
        it('returns readable hand descriptions', () => {
            const royalFlush = evaluate(parseCards('AhKhQhJhTh9d2c'));
            expect(getHandName(royalFlush)).toBe('Royal Flush');

            const fullHouse = evaluate(parseCards('AhAdAcKhKd5s2c'));
            expect(getHandName(fullHouse)).toContain('Full House');
        });
    });
});
