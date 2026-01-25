/**
 * River Scenario Test: OOP facing large bet with second pair
 *
 * Situation:
 * - River board: Ks Td 2c 5s 2h
 * - OOP hand: Ts9s (second pair with 9 kicker)
 * - IP hand: AsKh (top pair with ace kicker)
 * - Pot: 100, Stack: 200
 * - Action: OOP Check -> IP Bet 75 -> OOP to act
 *
 * Expected GTO (reference solver):
 * - Raise: 0%
 * - Fold: >= 80%
 * - Call: ~20%
 *
 * Current bug: Returns 33/33/33 (uniform distribution)
 */

import { Card, GameState, Player } from '../types';
import { CFRNode } from './types';
import { InfosetStore, regretMatch, getAverageStrategy } from './InfosetStore';
import { cfr, cfrWithShowdown, buildRiverTree, getStrategy, evaluateShowdown } from './cfr';

describe('River Scenario: OOP facing large bet with second pair', () => {
    // Board: Ks Td 2c 5s 2h
    const board: Card[] = [
        { rank: 'K', suit: 's' },
        { rank: 'T', suit: 'd' },
        { rank: '2', suit: 'c' },
        { rank: '5', suit: 's' },
        { rank: '2', suit: 'h' }
    ];

    // OOP hand: Ts9s (second pair - pair of tens with 9 kicker)
    const oopHand: Card[] = [
        { rank: 'T', suit: 's' },
        { rank: '9', suit: 's' }
    ];

    // IP hand: AsKh (top pair - pair of kings with ace kicker)
    const ipHand: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: 'K', suit: 'h' }
    ];

    it('should correctly evaluate showdown (IP wins with top pair)', () => {
        const result = evaluateShowdown(oopHand, ipHand, board, 100);
        // IP has KK with A kicker, OOP has TT with 9 kicker
        // IP wins, so payoff for OOP (P0) should be negative
        expect(result).toBeLessThan(0);
        console.log('Showdown result (OOP perspective):', result);
    });

    it('should build tree with correct facing bet scenario', () => {
        // Create game state where OOP already checked and IP bet 75
        // Now OOP faces a bet
        const players: Player[] = [
            {
                id: 'p0', seat: 0, name: 'OOP', stack: 200, bet: 0, totalBet: 0,
                status: 'active', holeCards: oopHand, hasActed: true, actedOnStreet: true,
                startHandStack: 200
            },
            {
                id: 'p1', seat: 1, name: 'IP', stack: 125, bet: 75, totalBet: 75,
                status: 'active', holeCards: ipHand, hasActed: true, actedOnStreet: true,
                startHandStack: 200
            }
        ];

        const gameState: GameState = {
            config: { maxSeats: 2, smallBlind: 1, bigBlind: 2, ante: 0 },
            rngState: { seed: 0, state: 0 },
            deck: [],
            players,
            pots: [{ amount: 100, eligiblePlayers: ['p0', 'p1'] }], // Initial pot before bets
            communityCards: board,
            street: 'river',
            dealerSeat: 1, // P1 is IP/Dealer
            actionSeat: 0, // P0 (OOP) to act, facing bet
            minRaise: 75,
            currentBet: 75,
            lastAggressor: 'p1',
            lastRaiseIsFull: true
        };

        const tree = buildRiverTree(gameState, [0.75], 1);

        // The root should be P0 (OOP) facing a bet of 75
        expect(tree.playerToAct).toBe(0);

        // Actions should be: Fold, Call, Raise (not Check, not Bet)
        const actionTypes = tree.actions.map(a => a.type);
        console.log('Available actions at root:', actionTypes);
        console.log('Action amounts:', tree.actions.map(a => a.amount));

        expect(actionTypes).toContain('fold');
        expect(actionTypes).toContain('call');
        // Raise may or may not be present depending on stack sizes
    });

    it('should converge to correct strategy: mostly fold with some call', () => {
        const store = new InfosetStore();

        // Build a simple tree for the scenario:
        // OOP faces a 75 bet into 100 pot (now 175 effective)
        // OOP can: Fold, Call
        // After Call: Showdown (IP wins with top pair)

        let id = 0;

        // Terminal: OOP folds -> IP wins the pot (175 with the bet)
        // OOP was already committed to check (0), so loses nothing more
        // Payoff for OOP: -pot/2 = -50 (the money already in middle)
        const oopFolds: CFRNode = {
            id: id++,
            playerToAct: -1,
            actions: [],
            children: [],
            isTerminal: true,
            payoff: -50 // OOP loses their share of initial pot
        };

        // Terminal: OOP calls 75, total pot = 175 + 75 = 250
        // Showdown: IP wins with top pair (KK vs TT)
        // OOP loses call amount + their pot share
        const oopCallsAndLoses: CFRNode = {
            id: id++,
            playerToAct: -1,
            actions: [],
            children: [],
            isTerminal: true,
            payoff: -125 // OOP loses pot/2 + call = 50 + 75
        };

        // Terminal: OOP raises (all-in 200), IP calls (has 125 left)
        // If IP calls: Showdown at larger pot
        // This branch would be complex, let's simplify by assuming raise is not optimal
        // For the test, we'll just have Fold/Call

        // OOP's decision facing bet
        const oopDecision: CFRNode = {
            id: id++,
            playerToAct: 0, // OOP (P0)
            actions: [
                { type: 'fold', amount: 0 },
                { type: 'call', amount: 75 }
            ],
            children: [oopFolds, oopCallsAndLoses],
            isTerminal: false
        };

        // Run many iterations
        const iterations = 50000;

        for (let i = 0; i < iterations; i++) {
            // OOP has Ts9s, IP has AsKh
            cfr(oopDecision, 1, 1, oopHand, ipHand, board, store);
        }

        // Get OOP's strategy
        const strategy = getStrategy(store, oopDecision.id, oopHand, board, 2);

        console.log('\n=== OOP Strategy facing 75 bet with Ts9s ===');
        console.log('  Fold:', (strategy[0] * 100).toFixed(1) + '%');
        console.log('  Call:', (strategy[1] * 100).toFixed(1) + '%');

        // Verify GTO expectations:
        // - Fold should be high (>= 70%)
        // - Call should be low (~20-30%)
        expect(strategy[0]).toBeGreaterThan(0.6); // Fold should be dominant
        expect(strategy[0]).not.toBeCloseTo(0.5, 1); // Should NOT be 50/50

        // The key test: NOT 33/33/33 or 50/50
        expect(Math.abs(strategy[0] - strategy[1])).toBeGreaterThan(0.2);
    });

    it('should differentiate strategy based on hand strength', () => {
        const store = new InfosetStore();

        // Two scenarios:
        // 1. OOP has Ts9s (weak) vs IP AsKh -> OOP should mostly fold
        // 2. OOP has KdQh (strong - two pair) vs IP 7h6h -> OOP should mostly call/raise

        const weakOopHand: Card[] = [{ rank: 'T', suit: 's' }, { rank: '9', suit: 's' }];
        const strongOopHand: Card[] = [{ rank: 'K', suit: 'd' }, { rank: 'Q', suit: 'h' }]; // Makes KK with Q kicker
        const ipValueHand: Card[] = [{ rank: 'A', suit: 's' }, { rank: 'K', suit: 'h' }];
        const ipBluffHand: Card[] = [{ rank: '7', suit: 'h' }, { rank: '6', suit: 'h' }];

        let id = 0;

        // Create two separate trees for each matchup
        const createTree = (oopWins: boolean): CFRNode => {
            const foldPayoff = -50; // OOP always loses pot share when folding
            const callPayoff = oopWins ? 125 : -125; // Win or lose full pot

            const foldNode: CFRNode = {
                id: id++, playerToAct: -1, actions: [], children: [],
                isTerminal: true, payoff: foldPayoff
            };

            const callNode: CFRNode = {
                id: id++, playerToAct: -1, actions: [], children: [],
                isTerminal: true, payoff: callPayoff
            };

            return {
                id: id++,
                playerToAct: 0,
                actions: [
                    { type: 'fold', amount: 0 },
                    { type: 'call', amount: 75 }
                ],
                children: [foldNode, callNode],
                isTerminal: false
            };
        };

        const treeOopLoses = createTree(false); // OOP has weak hand
        const treeOopWins = createTree(true);   // OOP has strong hand

        // Train both scenarios
        const iterations = 30000;

        for (let i = 0; i < iterations; i++) {
            // Weak OOP vs Value IP -> OOP loses at showdown
            cfr(treeOopLoses, 1, 1, weakOopHand, ipValueHand, board, store);

            // Strong OOP vs Bluff IP -> OOP wins at showdown
            cfr(treeOopWins, 1, 1, strongOopHand, ipBluffHand, board, store);
        }

        // Get strategies
        const weakStrategy = getStrategy(store, treeOopLoses.id, weakOopHand, board, 2);
        const strongStrategy = getStrategy(store, treeOopWins.id, strongOopHand, board, 2);

        console.log('\n=== Strategy Comparison ===');
        console.log('Weak hand (Ts9s vs AsKh - loses):');
        console.log('  Fold:', (weakStrategy[0] * 100).toFixed(1) + '%');
        console.log('  Call:', (weakStrategy[1] * 100).toFixed(1) + '%');

        console.log('Strong hand (KdQh vs 76h - wins):');
        console.log('  Fold:', (strongStrategy[0] * 100).toFixed(1) + '%');
        console.log('  Call:', (strongStrategy[1] * 100).toFixed(1) + '%');

        // Weak hand should fold more
        expect(weakStrategy[0]).toBeGreaterThan(strongStrategy[0]);

        // Strong hand should call more
        expect(strongStrategy[1]).toBeGreaterThan(weakStrategy[1]);

        // Weak hand should NOT be 50/50
        expect(weakStrategy[0]).toBeGreaterThan(0.6);

        // Strong hand should call frequently
        expect(strongStrategy[1]).toBeGreaterThan(0.7);
    });

    it('should handle full tree with showdown evaluation', () => {
        const store = new InfosetStore();

        // Build tree from game state (OOP starts action)
        const players: Player[] = [
            {
                id: 'p0', seat: 0, name: 'OOP', stack: 200, bet: 0, totalBet: 0,
                status: 'active', holeCards: oopHand, hasActed: false, actedOnStreet: false,
                startHandStack: 200
            },
            {
                id: 'p1', seat: 1, name: 'IP', stack: 200, bet: 0, totalBet: 0,
                status: 'active', holeCards: ipHand, hasActed: false, actedOnStreet: false,
                startHandStack: 200
            }
        ];

        const gameState: GameState = {
            config: { maxSeats: 2, smallBlind: 1, bigBlind: 2, ante: 0 },
            rngState: { seed: 0, state: 0 },
            deck: [],
            players,
            pots: [{ amount: 100, eligiblePlayers: ['p0', 'p1'] }],
            communityCards: board,
            street: 'river',
            dealerSeat: 1,
            actionSeat: 0,
            minRaise: 2,
            currentBet: 0,
            lastAggressor: null,
            lastRaiseIsFull: true
        };

        const tree = buildRiverTree(gameState, [0.75], 1);

        // Log tree structure
        console.log('\n=== Tree Structure ===');
        console.log('Root node:', {
            playerToAct: tree.playerToAct,
            actions: tree.actions.map(a => `${a.type} ${a.amount}`),
            numChildren: tree.children.length
        });

        // Run CFR with showdown evaluation
        const iterations = 10000;
        const initialPot = 100;

        for (let i = 0; i < iterations; i++) {
            cfrWithShowdown(
                tree, 1, 1,
                oopHand, ipHand, board, store,
                evaluateShowdown,
                initialPot
            );
        }

        // After OOP checks, find IP's node
        const checkChild = tree.children[0]; // Assuming check is first action
        if (checkChild) {
            console.log('After OOP check, IP node:', {
                playerToAct: checkChild.playerToAct,
                actions: checkChild.actions.map(a => `${a.type} ${a.amount}`),
            });

            // Get IP's strategy at this node
            const ipStrategy = getStrategy(store, checkChild.id, ipHand, board, checkChild.actions.length);
            console.log('IP strategy (AsKh):');
            checkChild.actions.forEach((a, i) => {
                console.log(`  ${a.type} ${a.amount}: ${(ipStrategy[i] * 100).toFixed(1)}%`);
            });

            // IP should bet for value with top pair
            const betIdx = checkChild.actions.findIndex(a => a.type === 'bet');
            if (betIdx >= 0) {
                expect(ipStrategy[betIdx]).toBeGreaterThan(0.5); // Should bet for value
            }

            // After IP bets, find OOP's response node
            if (betIdx >= 0 && checkChild.children[betIdx]) {
                const oopResponse = checkChild.children[betIdx];
                console.log('After IP bet, OOP response node:', {
                    playerToAct: oopResponse.playerToAct,
                    actions: oopResponse.actions.map(a => `${a.type} ${a.amount}`),
                });

                // Get OOP's strategy at this node
                const oopStrategy = getStrategy(store, oopResponse.id, oopHand, board, oopResponse.actions.length);
                console.log('OOP strategy (Ts9s) facing bet:');
                oopResponse.actions.forEach((a, i) => {
                    console.log(`  ${a.type} ${a.amount}: ${(oopStrategy[i] * 100).toFixed(1)}%`);
                });

                // OOP should mostly fold with second pair facing bet
                const foldIdx = oopResponse.actions.findIndex(a => a.type === 'fold');
                if (foldIdx >= 0) {
                    // This is the KEY test - fold should be high, NOT 33%
                    expect(oopStrategy[foldIdx]).toBeGreaterThan(0.5);
                    console.log('\n*** KEY RESULT: OOP fold frequency =', (oopStrategy[foldIdx] * 100).toFixed(1) + '%');
                }
            }
        }
    });
});

describe('Debug: Check regret accumulation', () => {
    it('should accumulate non-zero regrets', () => {
        const store = new InfosetStore();

        // Simple tree: P0 can fold (lose 50) or call (lose 100)
        // P0 should always fold since it loses less
        let id = 0;

        const foldNode: CFRNode = {
            id: id++, playerToAct: -1, actions: [], children: [],
            isTerminal: true, payoff: -50
        };

        const callNode: CFRNode = {
            id: id++, playerToAct: -1, actions: [], children: [],
            isTerminal: true, payoff: -100
        };

        const root: CFRNode = {
            id: id++,
            playerToAct: 0,
            actions: [{ type: 'fold', amount: 0 }, { type: 'call', amount: 75 }],
            children: [foldNode, callNode],
            isTerminal: false
        };

        const hand: Card[] = [{ rank: 'A', suit: 'h' }, { rank: 'A', suit: 's' }];
        const oppHand: Card[] = [{ rank: 'K', suit: 'h' }, { rank: 'K', suit: 's' }];
        const board: Card[] = [
            { rank: 'Q', suit: 'h' }, { rank: 'J', suit: 'h' },
            { rank: 'T', suit: 'c' }, { rank: '5', suit: 'd' }, { rank: '3', suit: 's' }
        ];

        // Run single iteration
        cfr(root, 1, 1, hand, oppHand, board, store);

        // Check regrets
        const key = store.generateKey(root.id, hand, board);
        const data = store.get(key, 2);
        const regrets = InfosetStore.getRegrets(data, 2);

        console.log('\n=== After 1 iteration ===');
        console.log('Regrets:', Array.from(regrets));

        // Fold has payoff -50, Call has payoff -100
        // Node value (with uniform 50/50): (-50 * 0.5) + (-100 * 0.5) = -75
        // Fold regret: -50 - (-75) = 25 (positive - should fold more)
        // Call regret: -100 - (-75) = -25 (negative - should call less)

        expect(regrets[0]).toBeGreaterThan(0); // Fold regret should be positive
        expect(regrets[1]).toBeLessThan(0); // Call regret should be negative

        // Run more iterations
        for (let i = 0; i < 1000; i++) {
            cfr(root, 1, 1, hand, oppHand, board, store);
        }

        const strategy = new Float64Array(2);
        const newRegrets = InfosetStore.getRegrets(store.get(key, 2), 2);
        regretMatch(newRegrets, strategy);

        console.log('\n=== After 1001 iterations ===');
        console.log('Regrets:', Array.from(newRegrets));
        console.log('Strategy:', Array.from(strategy));

        // P0 should strongly prefer fold
        expect(strategy[0]).toBeGreaterThan(0.9); // Fold should be >90%
    });
});
