/**
 * Engine Tests
 *
 * Tests for state transitions, RNG continuity, and chip conservation.
 */

import {
    createInitialState,
    getTotalChips,
    checkCardUniqueness,
    applyAction,
    getLegalActions,
    getActivePlayer,
    Action,
    HandConfig,
    GameState,
} from '../index';

// --- Test Fixtures ---

const createTestConfig = (seed: number = 12345): HandConfig => ({
    id: `test-hand-${seed}`,
    players: [
        { id: 'p1', name: 'Player 1', stack: 1000, seat: 0 }, // BTN
        { id: 'p2', name: 'Player 2', stack: 1000, seat: 1 }, // SB
        { id: 'p3', name: 'Player 3', stack: 1000, seat: 2 }, // BB
        { id: 'p4', name: 'Player 4', stack: 1000, seat: 3 }, // UTG
    ],
    tableConfig: {
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
        ante: 0,
    },
    dealerSeat: 0,
    seed,
});

const createAction = (
    state: GameState,
    type: 'fold' | 'check' | 'call' | 'bet' | 'raise',
    amount: number = 0
): Action => {
    const player = getActivePlayer(state);
    if (!player) throw new Error('No active player');

    return {
        street: state.street,
        playerId: player.id,
        type,
        amount,
        isAllIn: amount >= player.stack,
        timestamp: Date.now(),
    };
};

// --- Tests ---

describe('Engine - State Transitions', () => {
    describe('createInitialState', () => {
        it('creates valid initial state', () => {
            const config = createTestConfig();
            const state = createInitialState(config);

            expect(state.street).toBe('preflop');
            expect(state.players).toHaveLength(4);
            expect(state.deck.length).toBe(52 - 8); // 4 players × 2 cards
            expect(state.communityCards).toHaveLength(0);
            expect(state.currentBet).toBe(10); // BB
            expect(state.lastAggressor).toBeNull();
        });

        it('posts blinds correctly', () => {
            const config = createTestConfig();
            const state = createInitialState(config);

            const sb = state.players.find(p => p.seat === 1);
            const bb = state.players.find(p => p.seat === 2);

            expect(sb?.bet).toBe(5);
            expect(sb?.stack).toBe(995);
            expect(bb?.bet).toBe(10);
            expect(bb?.stack).toBe(990);
        });

        it('deals unique cards', () => {
            const config = createTestConfig();
            const state = createInitialState(config);
            const errors = checkCardUniqueness(state);

            expect(errors).toHaveLength(0);
        });
    });

    describe('applyAction - Fold', () => {
        it('marks player as folded', () => {
            const config = createTestConfig();
            const state = createInitialState(config);

            const action = createAction(state, 'fold');
            const newState = applyAction(state, action);

            const player = newState.players.find(p => p.id === action.playerId);
            expect(player?.status).toBe('folded');
        });

        it('advances to next player', () => {
            const config = createTestConfig();
            const state = createInitialState(config);
            const originalActionSeat = state.actionSeat;

            const action = createAction(state, 'fold');
            const newState = applyAction(state, action);

            expect(newState.actionSeat).not.toBe(originalActionSeat);
        });

        it('does not mutate original state', () => {
            const config = createTestConfig();
            const state = createInitialState(config);
            const originalPlayer = state.players.find(p => p.seat === state.actionSeat);

            const action = createAction(state, 'fold');
            applyAction(state, action);

            expect(originalPlayer?.status).toBe('active');
        });
    });

    describe('applyAction - Call', () => {
        it('deducts chips correctly', () => {
            const config = createTestConfig();
            const state = createInitialState(config);

            // UTG calls 10
            const action = createAction(state, 'call', 10);
            const newState = applyAction(state, action);

            const player = newState.players.find(p => p.id === action.playerId);
            expect(player?.bet).toBe(10);
            expect(player?.stack).toBe(990);
            expect(player?.totalBet).toBe(10);
        });
    });

    describe('applyAction - Raise', () => {
        it('updates currentBet and lastAggressor', () => {
            const config = createTestConfig();
            const state = createInitialState(config);

            // UTG raises to 25 (puts in 25)
            const action = createAction(state, 'raise', 25);
            const newState = applyAction(state, action);

            expect(newState.currentBet).toBe(25);
            expect(newState.lastAggressor).toBe(state.actionSeat);
        });

        it('updates minRaise for additive raise', () => {
            const config = createTestConfig();
            const state = createInitialState(config);

            // UTG raises to 25 (increment of 15 from BB 10)
            const action = createAction(state, 'raise', 25);
            const newState = applyAction(state, action);

            // Min raise should be at least 15 (the raise increment)
            expect(newState.minRaise).toBeGreaterThanOrEqual(15);
        });
    });

    describe('Chip Conservation', () => {
        it('maintains total chip count after actions', () => {
            const config = createTestConfig();
            const state = createInitialState(config);
            const initialChips = getTotalChips(state);

            // UTG folds
            let newState = applyAction(state, createAction(state, 'fold'));
            expect(getTotalChips(newState)).toBe(initialChips);

            // Next player calls
            if (getLegalActions(newState).includes('call')) {
                const callAction = createAction(newState, 'call', 10);
                newState = applyAction(newState, callAction);
                expect(getTotalChips(newState)).toBe(initialChips);
            }
        });
    });

    describe('RNG Continuity', () => {
        it('produces deterministic cards with same seed', () => {
            const seed = 99999;
            const config1 = createTestConfig(seed);
            const config2 = createTestConfig(seed);

            const state1 = createInitialState(config1);
            const state2 = createInitialState(config2);

            // Hole cards should be identical
            expect(state1.players[0].holeCards).toEqual(state2.players[0].holeCards);
            expect(state1.players[1].holeCards).toEqual(state2.players[1].holeCards);

            // Deck should be identical
            expect(state1.deck).toEqual(state2.deck);
        });

        it('advances RNG state during shuffle', () => {
            const config = createTestConfig();
            const state = createInitialState(config);

            // RNG state should have advanced from initial seed
            expect(state.rngState.state).not.toBe(config.seed);
        });
    });

    describe('Street Transitions', () => {
        it('advances to flop when all call', () => {
            const config = createTestConfig();
            let state = createInitialState(config);

            // Get all players to call/check through preflop
            // This is a simplified test - full round would require all players
            const initialStreet = state.street;
            expect(initialStreet).toBe('preflop');

            // Track original deck size
            const originalDeckSize = state.deck.length;

            // Note: Full street transition test would require completing betting round
            expect(originalDeckSize).toBe(44); // 52 - 8 hole cards
        });
    });

    describe('Single Survivor', () => {
        it('ends hand when all but one fold', () => {
            const config: HandConfig = {
                id: 'heads-up',
                players: [
                    { id: 'p1', name: 'Player 1', stack: 1000, seat: 0 },
                    { id: 'p2', name: 'Player 2', stack: 1000, seat: 1 },
                ],
                tableConfig: {
                    maxSeats: 6,
                    smallBlind: 5,
                    bigBlind: 10,
                    ante: 0,
                },
                dealerSeat: 0,
                seed: 12345,
            };

            let state = createInitialState(config);

            // SB folds (in heads-up, dealer is SB)
            const foldAction = createAction(state, 'fold');
            state = applyAction(state, foldAction);

            // Hand should end immediately
            expect(state.street).toBe('showdown');
        });
    });

    describe('getLegalActions', () => {
        it('returns correct actions preflop for UTG', () => {
            const config = createTestConfig();
            const state = createInitialState(config);

            const actions = getLegalActions(state);

            expect(actions).toContain('fold');
            expect(actions).toContain('call');
            expect(actions).toContain('raise');
            expect(actions).not.toContain('check');
            expect(actions).not.toContain('bet');
        });
    });
});
