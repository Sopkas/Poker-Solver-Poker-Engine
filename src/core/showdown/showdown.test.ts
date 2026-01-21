/**
 * Showdown Resolution Tests
 * 
 * Tests for pot distribution, split pots, side pots, and odd chip handling.
 */

import {
    resolveShowdown,
    getShowdownResult,
    resolveSingleWinner,
    createInitialState,
    HandConfig,
    GameState,
    Player,
    Pot,
    Card
} from '../index';

// --- Test Helpers ---

const card = (rank: string, suit: string): Card => ({
    rank: rank as Card['rank'],
    suit: suit as Card['suit']
});

/**
 * Creates a test state at showdown with specified players and community cards.
 */
const createShowdownState = (
    playerConfigs: { id: string; seat: number; stack: number; holeCards: Card[]; folded?: boolean }[],
    communityCards: Card[],
    pots: Pot[],
    dealerSeat: number = 0
): GameState => {
    const players: Player[] = playerConfigs.map(p => ({
        id: p.id,
        seat: p.seat,
        name: `Player ${p.id}`,
        stack: p.stack,
        bet: 0,
        totalBet: 0,
        status: p.folded ? 'folded' : 'active',
        holeCards: p.holeCards,
        hasActed: true
    }));

    return {
        config: {
            maxSeats: 6,
            smallBlind: 5,
            bigBlind: 10,
            ante: 0
        },
        rngState: { seed: 12345, state: 12345 },
        deck: [],
        players,
        pots,
        communityCards,
        street: 'showdown',
        dealerSeat,
        actionSeat: 0,
        minRaise: 10,
        currentBet: 0,
        lastAggressor: null
    };
};

// --- Tests ---

describe('Showdown Resolution', () => {
    describe('Basic Showdown', () => {
        it('awards pot to single winner', () => {
            // P1 has better hand
            const state = createShowdownState(
                [
                    { id: 'p1', seat: 0, stack: 0, holeCards: [card('A', 'h'), card('K', 'h')] },
                    { id: 'p2', seat: 1, stack: 0, holeCards: [card('7', 'd'), card('2', 'c')] }
                ],
                [card('A', 'd'), card('K', 'd'), card('Q', 'c'), card('J', 's'), card('9', 'h')],
                [{ amount: 100, eligiblePlayers: ['p1', 'p2'] }]
            );

            const newState = resolveShowdown(state);

            const p1 = newState.players.find(p => p.id === 'p1')!;
            const p2 = newState.players.find(p => p.id === 'p2')!;

            expect(p1.stack).toBe(100);
            expect(p2.stack).toBe(0);
            expect(newState.pots).toHaveLength(0);
        });
    });

    describe('Split Pot', () => {
        it('splits pot evenly between two tied players', () => {
            // Both players have same hand (board plays)
            const state = createShowdownState(
                [
                    { id: 'p1', seat: 0, stack: 0, holeCards: [card('2', 'h'), card('3', 'h')] },
                    { id: 'p2', seat: 1, stack: 0, holeCards: [card('2', 'd'), card('3', 'd')] }
                ],
                [card('A', 'h'), card('K', 'd'), card('Q', 'c'), card('J', 's'), card('T', 'h')],
                [{ amount: 100, eligiblePlayers: ['p1', 'p2'] }]
            );

            const newState = resolveShowdown(state);

            const p1 = newState.players.find(p => p.id === 'p1')!;
            const p2 = newState.players.find(p => p.id === 'p2')!;

            expect(p1.stack).toBe(50);
            expect(p2.stack).toBe(50);
        });

        it('handles odd chip - first clockwise from dealer gets extra', () => {
            // Pot of 25 chips, two winners, dealer at seat 0
            const state = createShowdownState(
                [
                    { id: 'p1', seat: 1, stack: 0, holeCards: [card('2', 'h'), card('3', 'h')] },
                    { id: 'p2', seat: 2, stack: 0, holeCards: [card('2', 'd'), card('3', 'd')] }
                ],
                [card('A', 'h'), card('K', 'd'), card('Q', 'c'), card('J', 's'), card('T', 'h')],
                [{ amount: 25, eligiblePlayers: ['p1', 'p2'] }],
                0 // Dealer at seat 0
            );

            const newState = resolveShowdown(state);

            const p1 = newState.players.find(p => p.id === 'p1')!;
            const p2 = newState.players.find(p => p.id === 'p2')!;

            // P1 is at seat 1 (closer to dealer), gets 13
            // P2 is at seat 2, gets 12
            expect(p1.stack).toBe(13);
            expect(p2.stack).toBe(12);
            expect(p1.stack + p2.stack).toBe(25);
        });
    });

    describe('Side Pots - 3-Way All-In', () => {
        it('correctly distributes main pot and side pot', () => {
            // P1: 10 chips all-in, BEST hand (Aces full)
            // P2: 50 chips all-in, MEDIUM hand (Kings full)
            // P3: 100 chips, WORST hand (Queens full)
            //
            // Pot structure:
            // Main pot: 30 chips (10 from each) - P1 wins (best hand)
            // Side pot: 80 chips (40 from P2, 40 from P3) - P2 wins (P1 not eligible)
            //
            // Result: P1 gets 30, P2 gets 80, P3 gets 0

            const state = createShowdownState(
                [
                    // P1 has Aces with King kicker - makes AA with AKQ kickers (Two Pair AA KK Q if board has K)
                    // Actually let's make it simpler: P1 has trips, P2 has pair, P3 has high card
                    { id: 'p1', seat: 0, stack: 0, holeCards: [card('A', 'h'), card('A', 'd')] }, // Trips Aces
                    { id: 'p2', seat: 1, stack: 0, holeCards: [card('K', 'h'), card('K', 's')] }, // Trips Kings  
                    { id: 'p3', seat: 2, stack: 0, holeCards: [card('Q', 'h'), card('J', 'h')] }  // Two Pair QQ JJ or less
                ],
                // Board: A K 8 7 2 (rainbow) - gives P1 AAA, P2 KKK, P3 just high cards
                [card('A', 'c'), card('K', 'd'), card('8', 'c'), card('7', 's'), card('2', 'h')],
                [
                    { amount: 30, eligiblePlayers: ['p1', 'p2', 'p3'] }, // Main pot
                    { amount: 80, eligiblePlayers: ['p2', 'p3'] }        // Side pot
                ]
            );

            const newState = resolveShowdown(state);

            const p1 = newState.players.find(p => p.id === 'p1')!;
            const p2 = newState.players.find(p => p.id === 'p2')!;
            const p3 = newState.players.find(p => p.id === 'p3')!;

            expect(p1.stack).toBe(30); // Wins main pot
            expect(p2.stack).toBe(80); // Wins side pot
            expect(p3.stack).toBe(0);  // Loses everything
        });
    });

    describe('Folded Players', () => {
        it('excludes folded players from pot distribution', () => {
            const state = createShowdownState(
                [
                    { id: 'p1', seat: 0, stack: 0, holeCards: [card('2', 'h'), card('3', 'h')], folded: true },
                    { id: 'p2', seat: 1, stack: 0, holeCards: [card('7', 'd'), card('8', 'd')] }
                ],
                [card('A', 'h'), card('K', 'd'), card('Q', 'c'), card('J', 's'), card('T', 'h')],
                [{ amount: 100, eligiblePlayers: ['p1', 'p2'] }]
            );

            const newState = resolveShowdown(state);

            const p1 = newState.players.find(p => p.id === 'p1')!;
            const p2 = newState.players.find(p => p.id === 'p2')!;

            expect(p1.stack).toBe(0);
            expect(p2.stack).toBe(100);
        });
    });

    describe('getShowdownResult', () => {
        it('returns winner information without modifying state', () => {
            const state = createShowdownState(
                [
                    { id: 'p1', seat: 0, stack: 100, holeCards: [card('A', 'h'), card('K', 'h')] },
                    { id: 'p2', seat: 1, stack: 100, holeCards: [card('7', 'd'), card('2', 'c')] }
                ],
                [card('A', 'd'), card('K', 'd'), card('Q', 'c'), card('J', 's'), card('9', 'h')],
                [{ amount: 50, eligiblePlayers: ['p1', 'p2'] }]
            );

            const result = getShowdownResult(state);

            expect(result.winners).toHaveLength(1);
            expect(result.winners[0].playerId).toBe('p1');
            expect(result.winners[0].amount).toBe(50);

            // Original state should be unchanged
            expect(state.players.find(p => p.id === 'p1')!.stack).toBe(100);
            expect(state.pots).toHaveLength(1);
        });

        it('includes hand rankings for all non-folded players', () => {
            const state = createShowdownState(
                [
                    { id: 'p1', seat: 0, stack: 0, holeCards: [card('A', 'h'), card('K', 'h')] },
                    { id: 'p2', seat: 1, stack: 0, holeCards: [card('7', 'd'), card('2', 'c')] },
                    { id: 'p3', seat: 2, stack: 0, holeCards: [card('Q', 'h'), card('Q', 'd')], folded: true }
                ],
                [card('A', 'd'), card('K', 'd'), card('Q', 'c'), card('J', 's'), card('9', 'h')],
                [{ amount: 100, eligiblePlayers: ['p1', 'p2', 'p3'] }]
            );

            const result = getShowdownResult(state);

            // Should have ranks for p1 and p2, but not p3 (folded)
            expect(result.ranks.map(r => r.playerId)).toContain('p1');
            expect(result.ranks.map(r => r.playerId)).toContain('p2');
            expect(result.ranks.map(r => r.playerId)).not.toContain('p3');
        });
    });

    describe('resolveSingleWinner', () => {
        it('awards all pots to remaining player', () => {
            const state = createShowdownState(
                [
                    { id: 'p1', seat: 0, stack: 0, holeCards: [card('A', 'h'), card('K', 'h')] },
                    { id: 'p2', seat: 1, stack: 0, holeCards: [card('7', 'd'), card('2', 'c')], folded: true }
                ],
                [], // No community cards needed
                [
                    { amount: 50, eligiblePlayers: ['p1', 'p2'] },
                    { amount: 30, eligiblePlayers: ['p1'] }
                ]
            );

            const newState = resolveSingleWinner(state);

            const p1 = newState.players.find(p => p.id === 'p1')!;
            expect(p1.stack).toBe(80); // 50 + 30
            expect(newState.pots).toHaveLength(0);
        });
    });

    describe('Edge Cases', () => {
        it('throws error if not at showdown street', () => {
            const state = createShowdownState(
                [
                    { id: 'p1', seat: 0, stack: 0, holeCards: [card('A', 'h'), card('K', 'h')] },
                    { id: 'p2', seat: 1, stack: 0, holeCards: [card('7', 'd'), card('2', 'c')] }
                ],
                [card('A', 'd'), card('K', 'd'), card('Q', 'c'), card('J', 's'), card('9', 'h')],
                [{ amount: 100, eligiblePlayers: ['p1', 'p2'] }]
            );
            state.street = 'river'; // Not showdown

            expect(() => resolveShowdown(state)).toThrow('not at showdown street');
        });

        it('throws error if community cards incomplete', () => {
            const state = createShowdownState(
                [
                    { id: 'p1', seat: 0, stack: 0, holeCards: [card('A', 'h'), card('K', 'h')] },
                    { id: 'p2', seat: 1, stack: 0, holeCards: [card('7', 'd'), card('2', 'c')] }
                ],
                [card('A', 'd'), card('K', 'd'), card('Q', 'c')], // Only 3 cards
                [{ amount: 100, eligiblePlayers: ['p1', 'p2'] }]
            );

            expect(() => resolveShowdown(state)).toThrow('need 5 community cards');
        });

        it('handles 3-way split pot with odd chips', () => {
            // 100 chips split 3 ways = 33, 33, 34
            const state = createShowdownState(
                [
                    { id: 'p1', seat: 1, stack: 0, holeCards: [card('2', 'h'), card('3', 'h')] },
                    { id: 'p2', seat: 2, stack: 0, holeCards: [card('2', 'd'), card('3', 'd')] },
                    { id: 'p3', seat: 3, stack: 0, holeCards: [card('2', 'c'), card('3', 'c')] }
                ],
                [card('A', 'h'), card('K', 'd'), card('Q', 'c'), card('J', 's'), card('T', 'h')],
                [{ amount: 100, eligiblePlayers: ['p1', 'p2', 'p3'] }],
                0 // Dealer at seat 0
            );

            const newState = resolveShowdown(state);

            const stacks = newState.players.map(p => p.stack).sort((a, b) => b - a);
            const total = stacks.reduce((a, b) => a + b, 0);

            expect(total).toBe(100);
            expect(stacks).toEqual([34, 33, 33]); // First clockwise gets odd chip
        });
    });
});
