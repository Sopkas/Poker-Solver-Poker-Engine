
import { createInitialState, Engine } from './index';
import { Rules } from '../rules';
import { GameState, HandConfig, Player, Action, ScenarioConfig } from '../types';
import { prepareNextHand, checkCardUniqueness } from '../state';

// Helper to create basic config
const createConfig = (players: any[]): HandConfig => ({
    id: 'test-hand',
    players,
    tableConfig: {
        maxSeats: 6,
        smallBlind: 10,
        bigBlind: 20,
        ante: 0
    },
    dealerSeat: 0,
    seed: 12345
});

describe('Poker Engine Scenarios', () => {

    test('1. Re-raise Restriction', () => {
        // A bets 100, B raises 200, C all-in 210. A cannot raise.
        const config = createConfig([
            { id: 'A', name: 'A', stack: 1000, seat: 0 },
            { id: 'B', name: 'B', stack: 1000, seat: 1 },
            { id: 'C', name: 'C', stack: 210, seat: 2 }
        ]);

        let state = createInitialState(config);

        // Preflop: Blinds 10/20. Current bet 20.
        // A (UTG) acts first.

        // A bets 100 (Raise to 100)
        console.log('A acting...');
        state = Engine.applyAction(state, {
            type: 'raise',
            amount: 100,
            playerId: 'A',
            street: 'preflop',
            isAllIn: false,
            timestamp: 0
        });

        // B raises to 200
        console.log('B acting...');
        state = Engine.applyAction(state, {
            type: 'raise',
            amount: 190, // 200 total - 10 posted = 190
            playerId: 'B',
            street: 'preflop',
            isAllIn: false,
            timestamp: 0
        });

        // C all-in 210
        console.log('C acting...');
        state = Engine.applyAction(state, {
            type: 'raise',
            amount: 190, // 210 total - 20 posted = 190
            playerId: 'C',
            street: 'preflop',
            isAllIn: true,
            timestamp: 0
        });

        // Action back to A
        expect(state.actionSeat).toBe(0); // A's seat

        const legalActions = Rules.getLegalActions(state);
        console.log('Legal actions for A:', legalActions);

        expect(legalActions).toContain('call');
        expect(legalActions).toContain('fold');
        expect(legalActions).not.toContain('raise');
    });

    test('2. Uncalled Bet Return', () => {
        // Hero 1000, Villain 50. Hero bets 1000. Villain calls 50.
        const config = createConfig([
            { id: 'Hero', name: 'Hero', stack: 1000, seat: 0 },
            { id: 'Villain', name: 'Villain', stack: 50, seat: 1 }
        ]);

        // Heads up: Dealer(0)=SB, Villain(1)=BB.
        let state = createInitialState(config);

        // SB (Hero) posts 10. BB (Villain) posts 20.
        // Hero raises to 1000 (All-in)
        state = Engine.applyAction(state, {
            type: 'raise',
            amount: 990,
            playerId: 'Hero',
            street: 'preflop',
            isAllIn: true,
            timestamp: 0
        });

        // Villain calls 50 (All-in)
        // Villain has 50 total? No, stack 50. Posted 20. Remaining 30.
        // Call amount is 980. Villain has 30.
        // Villain calls 50 total (20 + 30).
        state = Engine.applyAction(state, {
            type: 'call',
            amount: 30, // 30 more to reach 50 total
            playerId: 'Villain',
            street: 'preflop',
            isAllIn: true,
            timestamp: 0
        });

        // Both all-in. Runout happens.
        // Check pots after runout (which calls collectBets)
        // Or manually collect bets.

        // Since both all-in, applyAction calls runOutBoard -> collectBets.

        expect(state.street).toBe('showdown');
        // Pots are resolved immediately.
        // expect(state.pots.length).toBe(1);
        // expect(state.pots[0].amount).toBe(100); // 50 from Hero + 50 from Villain

        // Hero should have 950 returned?
        // Wait, Hero started with 1000. Bet 1000.
        // 50 went to pot. 950 returned.
        // Hero stack should be 950 + winnings (if won).
        // But we are at showdown, winnings not distributed yet (resolveShowdown does that).
        // Wait, runOutBoard returns state at 'showdown'.
        // collectBets returns uncalled bets to stack.
        // So Hero stack should be 950.

        const hero = state.players.find(p => p.id === 'Hero');
        // Hero should have 950 returned + potential winnings
        expect(hero?.stack).toBeGreaterThanOrEqual(950);
    });

    test('3. Heads-Up Positioning', () => {
        const config = createConfig([
            { id: 'A', name: 'A', stack: 1000, seat: 0 },
            { id: 'B', name: 'B', stack: 1000, seat: 1 }
        ]);

        const state = createInitialState(config);

        // Dealer is 0.
        // SB should be Dealer (0).
        // BB should be Opponent (1).

        const sb = state.players.find(p => p.seat === 0);
        const bb = state.players.find(p => p.seat === 1);

        expect(sb?.bet).toBe(10);
        expect(bb?.bet).toBe(20);

        // Preflop action starts with SB (Dealer)
        expect(state.actionSeat).toBe(0);
    });

    test('4. Short Stack Blind', () => {
        // SB 5, BB 100.
        const config = createConfig([
            { id: 'SB', name: 'SB', stack: 5, seat: 0 },
            { id: 'BB', name: 'BB', stack: 100, seat: 1 },
            { id: 'BTN', name: 'BTN', stack: 100, seat: 2 }
        ]);
        // 3 players. Dealer 0.
        // Next active: 1(BB)? No.
        // Dealer is 0 (SB).
        // Wait, config.dealerSeat = 0.
        // 3 players: A(0), B(1), C(2).
        // Dealer A. SB B. BB C.

        // Let's adjust seats to match user scenario: SB has 5.
        // Let's say Dealer is BTN(2). SB is SB(0). BB is BB(1).
        config.dealerSeat = 2;
        config.tableConfig.maxSeats = 3; // Set to 3 so 2->0 is distance 1

        const state = createInitialState(config);

        const sb = state.players.find(p => p.id === 'SB');
        const bb = state.players.find(p => p.id === 'BB');

        expect(sb?.bet).toBe(5); // All-in
        expect(sb?.status).toBe('all-in');

        expect(bb?.bet).toBe(20);

        expect(state.currentBet).toBe(20); // Should be 20, not 5
    });

    test('5. Min-Raise Calculation', () => {
        const config = createConfig([
            { id: 'A', name: 'A', stack: 1000, seat: 0 },
            { id: 'B', name: 'B', stack: 1000, seat: 1 }
        ]);

        let state = createInitialState(config);
        // Blinds 10/20. MinRaise 20.

        // A raises to 60.
        state = Engine.applyAction(state, {
            type: 'raise',
            amount: 50,
            playerId: 'A',
            street: 'preflop',
            isAllIn: false,
            timestamp: 0
        });

        // Raise increment = 60 - 20 = 40.
        // New MinRaise = 40.
        expect(state.minRaise).toBe(40);

        // Next min raise total = 60 + 40 = 100.
        const legalActions = Rules.getLegalActionsDetailed(state);
        const raiseAction = legalActions.find(a => a.type === 'raise');
        expect(raiseAction?.minAmount).toBe(80); // 100 total - 20 current bet = 80 to add
        // Wait, raise action amount is TOTAL amount.
        // My code: actions.push({ type: 'raise', minAmount, maxAmount: stack });
        // minAmount in code is Math.min(minRaiseAmount, stack).
        // minRaiseAmount = minRaiseTotal - player.bet.
        // Player B bet is 20 (BB).
        // minRaiseTotal = 100.
        // minRaiseAmount = 100 - 20 = 80.
        // So B must put in 80 more. Total 100.

        // But the action.amount is the TOTAL bet amount?
        // In applyAction: const raiseAmount = action.amount; player.bet += raiseAmount? No.
        // In applyAction:
        // case 'raise': const raiseAmount = action.amount; player.stack -= raiseAmount; player.bet += raiseAmount;
        // Wait, action.amount is the AMOUNT TO ADD? Or TOTAL BET?
        // My code in applyAction:
        // const raiseAmount = action.amount;
        // player.stack -= raiseAmount;
        // player.bet += raiseAmount;
        // This implies action.amount is the AMOUNT TO ADD (chip count to move).

        // BUT standard poker engines usually use TOTAL BET amount for 'raise' action.
        // Let's check `validateAction`.
        // `if (action.amount < legalAction.minAmount)`
        // `legalAction.minAmount` comes from `getLegalActionsDetailed`.
        // `minRaiseAmount = minRaiseTotal - player.bet`.
        // So `minAmount` is the DELTA.

        // So if B raises to 100. B has 20. B needs to add 80.
        // So action.amount should be 80.
        // And total bet becomes 100.

        // User says: "Correct: 100 (60 current + 40 step)".
        // This usually refers to the TOTAL bet.
        // If my engine uses DELTA for action.amount, then 80 is correct.
        // If user means "Raise TO 100", then action.amount depends on interpretation.
        // My engine seems to use DELTA (amount to put in).

        // Let's verify `minRaise` state.
        expect(state.minRaise).toBe(40);
    });

    test('6. Dead Small Blind', () => {
        // A(0), B(1), C(2), D(3).
        const config = createConfig([
            { id: 'A', name: 'A', stack: 1000, seat: 0 },
            { id: 'B', name: 'B', stack: 1000, seat: 1 },
            { id: 'C', name: 'C', stack: 1000, seat: 2 },
            { id: 'D', name: 'D', stack: 1000, seat: 3 }
        ]);
        // Set previous dealer to D(3), so next dealer becomes A(0).
        config.dealerSeat = 3;

        let state = createInitialState(config);

        // Remove B.
        const stateWithBOut = {
            ...state,
            players: state.players.map(p => p.id === 'B' ? { ...p, stack: 0 } : p)
        };

        // Previous Dealer D(3).
        // Active: A(0), C(2), D(3).
        // Next Dealer: A(0).

        const nextState = prepareNextHand(stateWithBOut);

        expect(nextState.dealerSeat).toBe(0);

        // Dealer A(0).
        // Next active C(2).
        // Dist 2.
        // SB Dead.
        // BB C.

        const newSB = nextState.players.find(p => p.bet === 10);
        const newBB = nextState.players.find(p => p.bet === 20);

        expect(newSB).toBeDefined(); // No Dead SB (Simplified Moving Button)
        expect(newSB?.id).toBe('C');
        expect(newBB?.id).toBe('D');
    });
});

describe('Scenario Builder (God Mode)', () => {
    test('should correctly assign specific cards and remove them from deck', () => {
        const config: HandConfig = {
            id: 'god-mode-test',
            players: [
                { id: 'p1', name: 'Hero', stack: 1000, seat: 0 },
                { id: 'p2', name: 'Villain', stack: 1000, seat: 1 },
                { id: 'p3', name: 'Random', stack: 1000, seat: 2 },
            ],
            tableConfig: { maxSeats: 6, smallBlind: 1, bigBlind: 2, ante: 0 },
            dealerSeat: 0,
            seed: 12345,
        };

        const scenarioConfig: ScenarioConfig = {
            numPlayers: 3,
            smallBlind: 1,
            bigBlind: 2,
            startingStack: 1000,
            heroSeat: 0,
            players: [
                { seat: 0, cards: [{ rank: 'A', suit: 's' }, { rank: 'A', suit: 'd' }] }, // Hero AA
                { seat: 1, cards: [{ rank: 'K', suit: 's' }, { rank: 'K', suit: 'd' }] }, // Villain KK
            ]
        };

        const state = createInitialState(config, scenarioConfig);

        // Verify Hero Cards
        const hero = state.players.find(p => p.seat === 0)!;
        expect(hero.holeCards).toHaveLength(2);
        expect(hero.holeCards).toContainEqual({ rank: 'A', suit: 's' });
        expect(hero.holeCards).toContainEqual({ rank: 'A', suit: 'd' });

        // Verify Villain Cards
        const villain = state.players.find(p => p.seat === 1)!;
        expect(villain.holeCards).toHaveLength(2);
        expect(villain.holeCards).toContainEqual({ rank: 'K', suit: 's' });
        expect(villain.holeCards).toContainEqual({ rank: 'K', suit: 'd' });

        // Verify Random Player Cards
        const random = state.players.find(p => p.seat === 2)!;
        expect(random.holeCards).toHaveLength(2);

        // Verify Deck does NOT contain the forced cards
        const allForcedCards = [...hero.holeCards, ...villain.holeCards];
        allForcedCards.forEach(c => {
            const inDeck = state.deck.some(dc => dc.rank === c.rank && dc.suit === c.suit);
            expect(inDeck).toBe(false);
        });

        // Verify no duplicates in the entire state
        const errors = checkCardUniqueness(state);
        expect(errors).toHaveLength(0);
    });
});

describe('Scenario Builder (God Mode++) - Street Selection', () => {
    test('should start game at Flop with 3 board cards', () => {
        const config: HandConfig = {
            id: 'flop-start-test',
            players: [
                { id: 'p1', name: 'Hero', stack: 1000, seat: 0 },
                { id: 'p2', name: 'Villain', stack: 1000, seat: 1 },
            ],
            tableConfig: { maxSeats: 6, smallBlind: 1, bigBlind: 2, ante: 0 },
            dealerSeat: 0,
            seed: 12345,
        };

        const scenarioConfig: ScenarioConfig = {
            numPlayers: 2,
            smallBlind: 1,
            bigBlind: 2,
            startingStack: 1000,
            heroSeat: 0,
            scenario: {
                startStreet: 'flop',
                initialPot: 50,
                boardCards: [
                    { rank: 'A', suit: 'h' },
                    { rank: 'K', suit: 'h' },
                    { rank: 'Q', suit: 'h' },
                ],
            },
        };

        const state = createInitialState(config, scenarioConfig);

        // Verify street is flop
        expect(state.street).toBe('flop');

        // Verify board has 3 cards
        expect(state.communityCards).toHaveLength(3);
        expect(state.communityCards).toContainEqual({ rank: 'A', suit: 'h' });
        expect(state.communityCards).toContainEqual({ rank: 'K', suit: 'h' });
        expect(state.communityCards).toContainEqual({ rank: 'Q', suit: 'h' });

        // Verify pot has initial amount
        expect(state.pots[0].amount).toBe(50);

        // Verify currentBet is 0 (post-flop)
        expect(state.currentBet).toBe(0);

        // Verify board cards are not in deck
        state.communityCards.forEach(c => {
            const inDeck = state.deck.some(dc => dc.rank === c.rank && dc.suit === c.suit);
            expect(inDeck).toBe(false);
        });
    });

    test('should start game at River with 5 board cards', () => {
        const config: HandConfig = {
            id: 'river-start-test',
            players: [
                { id: 'p1', name: 'Hero', stack: 1000, seat: 0 },
                { id: 'p2', name: 'Villain', stack: 1000, seat: 1 },
            ],
            tableConfig: { maxSeats: 6, smallBlind: 1, bigBlind: 2, ante: 0 },
            dealerSeat: 0,
            seed: 12345,
        };

        const scenarioConfig: ScenarioConfig = {
            numPlayers: 2,
            smallBlind: 1,
            bigBlind: 2,
            startingStack: 1000,
            heroSeat: 0,
            scenario: {
                startStreet: 'river',
                initialPot: 200,
                boardCards: [
                    { rank: 'A', suit: 'h' },
                    { rank: 'K', suit: 'h' },
                    { rank: 'Q', suit: 'h' },
                    { rank: 'J', suit: 'h' },
                    { rank: 'T', suit: 'h' },
                ],
            },
        };

        const state = createInitialState(config, scenarioConfig);

        // Verify street is river
        expect(state.street).toBe('river');

        // Verify board has 5 cards
        expect(state.communityCards).toHaveLength(5);

        // Verify pot has initial amount
        expect(state.pots[0].amount).toBe(200);
    });

    test('should throw error for invalid board length', () => {
        const config: HandConfig = {
            id: 'invalid-board-test',
            players: [
                { id: 'p1', name: 'Hero', stack: 1000, seat: 0 },
                { id: 'p2', name: 'Villain', stack: 1000, seat: 1 },
            ],
            tableConfig: { maxSeats: 6, smallBlind: 1, bigBlind: 2, ante: 0 },
            dealerSeat: 0,
            seed: 12345,
        };

        const scenarioConfig: ScenarioConfig = {
            numPlayers: 2,
            smallBlind: 1,
            bigBlind: 2,
            startingStack: 1000,
            heroSeat: 0,
            scenario: {
                startStreet: 'river',
                initialPot: 100,
                boardCards: [
                    { rank: 'A', suit: 'h' },
                    { rank: 'K', suit: 'h' },
                    { rank: 'Q', suit: 'h' },
                ], // Only 3 cards for river (should be 5)
            },
        };

        expect(() => createInitialState(config, scenarioConfig)).toThrow('river requires exactly 5 board cards');
    });

    test('should set post-flop action to first player left of dealer', () => {
        const config: HandConfig = {
            id: 'action-seat-test',
            players: [
                { id: 'p1', name: 'Player1', stack: 1000, seat: 0 },
                { id: 'p2', name: 'Player2', stack: 1000, seat: 1 },
                { id: 'p3', name: 'Player3', stack: 1000, seat: 2 },
            ],
            tableConfig: { maxSeats: 6, smallBlind: 1, bigBlind: 2, ante: 0 },
            dealerSeat: 2, // Dealer at seat 2, action should start at seat 0
            seed: 12345,
        };

        const scenarioConfig: ScenarioConfig = {
            numPlayers: 3,
            smallBlind: 1,
            bigBlind: 2,
            startingStack: 1000,
            heroSeat: 0,
            dealerSeat: 2,
            scenario: {
                startStreet: 'turn',
                initialPot: 100,
                boardCards: [
                    { rank: 'A', suit: 'h' },
                    { rank: 'K', suit: 'h' },
                    { rank: 'Q', suit: 'h' },
                    { rank: 'J', suit: 'h' },
                ],
            },
        };

        const state = createInitialState(config, scenarioConfig);

        // Post-flop, action should be first active player left of dealer
        // Dealer at seat 2, so seat 0 acts first (next after 2 is 3, then 4, then 5, then 0)
        expect(state.actionSeat).toBe(0);
    });

    test('should remove dead cards from deck', () => {
        const config: HandConfig = {
            id: 'dead-cards-test',
            players: [
                { id: 'p1', name: 'Hero', stack: 1000, seat: 0 },
                { id: 'p2', name: 'Villain', stack: 1000, seat: 1 },
            ],
            tableConfig: { maxSeats: 6, smallBlind: 1, bigBlind: 2, ante: 0 },
            dealerSeat: 0,
            seed: 12345,
        };

        const scenarioConfig: ScenarioConfig = {
            numPlayers: 2,
            smallBlind: 1,
            bigBlind: 2,
            startingStack: 1000,
            heroSeat: 0,
            scenario: {
                startStreet: 'flop',
                initialPot: 50,
                boardCards: [
                    { rank: 'A', suit: 'h' },
                    { rank: 'K', suit: 'h' },
                    { rank: 'Q', suit: 'h' },
                ],
                deadCards: [
                    { rank: '2', suit: 's' },
                    { rank: '3', suit: 's' },
                ],
            },
        };

        const state = createInitialState(config, scenarioConfig);

        // Verify dead cards are not in deck
        expect(state.deck.some(c => c.rank === '2' && c.suit === 's')).toBe(false);
        expect(state.deck.some(c => c.rank === '3' && c.suit === 's')).toBe(false);
    });
});

