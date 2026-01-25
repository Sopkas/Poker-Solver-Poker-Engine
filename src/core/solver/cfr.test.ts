import { Card, GameState, Player } from '../types';
import { CFRNode, CFRAction } from './types';
import { InfosetStore, regretMatch, getAverageStrategy } from './InfosetStore';
import { cfr, buildRiverTree, getStrategy, cfrWithShowdown } from './cfr';

describe('InfosetStore', () => {
    it('should create and retrieve data arrays', () => {
        const store = new InfosetStore();

        const data1 = store.get('test-key', 3);
        expect(data1.length).toBe(6); // 3 regrets + 3 strategy sums
        expect(data1[0]).toBe(0);

        // Modify and retrieve
        data1[0] = 10;
        const data2 = store.get('test-key', 3);
        expect(data2[0]).toBe(10); // Same reference
    });

    it('should generate canonical keys for cards', () => {
        const store = new InfosetStore();

        const cards1: Card[] = [{ rank: 'A', suit: 'h' }, { rank: 'K', suit: 's' }];
        const cards2: Card[] = [{ rank: 'K', suit: 's' }, { rank: 'A', suit: 'h' }];
        const board: Card[] = [];

        const key1 = store.generateKey(1, cards1, board);
        const key2 = store.generateKey(1, cards2, board);

        // Same cards in different order should produce same key
        expect(key1).toBe(key2);
    });

    it('should track stats', () => {
        const store = new InfosetStore();

        store.get('key1', 2);
        store.get('key2', 2);
        store.get('key1', 2); // hit

        const stats = store.stats;
        expect(stats.misses).toBe(2);
        expect(stats.hits).toBe(1);
        expect(stats.size).toBe(2);
    });
});

describe('Regret Matching', () => {
    it('should normalize positive regrets', () => {
        const regrets = new Float64Array([10, 20, 10]);
        const strategy = new Float64Array(3);

        regretMatch(regrets, strategy);

        expect(strategy[0]).toBeCloseTo(0.25);
        expect(strategy[1]).toBeCloseTo(0.5);
        expect(strategy[2]).toBeCloseTo(0.25);
    });

    it('should use uniform when all regrets are non-positive', () => {
        const regrets = new Float64Array([-5, -10, 0]);
        const strategy = new Float64Array(3);

        regretMatch(regrets, strategy);

        expect(strategy[0]).toBeCloseTo(1 / 3);
        expect(strategy[1]).toBeCloseTo(1 / 3);
        expect(strategy[2]).toBeCloseTo(1 / 3);
    });

    it('should ignore negative regrets in normalization', () => {
        const regrets = new Float64Array([10, -5, 0]);
        const strategy = new Float64Array(3);

        regretMatch(regrets, strategy);

        expect(strategy[0]).toBeCloseTo(1);
        expect(strategy[1]).toBeCloseTo(0);
        expect(strategy[2]).toBeCloseTo(0);
    });
});

describe('CFR Algorithm', () => {
    /**
     * Kuhn-like River Scenario:
     *
     * Setup:
     * - Pot: 100
     * - Stacks: 100 each
     * - P0 (OOP) has checked
     * - P1 (IP) can: Check (showdown) or Bet 100 (all-in)
     *
     * Hands:
     * - Strong (A): Wins at showdown
     * - Weak (2): Loses at showdown
     *
     * If P1 bets:
     * - P0 can Fold or Call
     *
     * Expected GTO behavior:
     * - P1 should bet strong hands for value
     * - P1 should check weak hands (no bluff value when P0 always has check range)
     * - P0 should call with strong, fold with weak when facing bet
     */

    function createKuhnLikeTree(): CFRNode {
        let id = 0;

        // Terminal: P0 wins showdown (has A vs 2)
        const p0WinsShowdown: CFRNode = {
            id: id++,
            playerToAct: -1,
            actions: [],
            children: [],
            isTerminal: true,
            payoff: 50 // P0 wins half pot (pot was 100)
        };

        // Terminal: P1 wins showdown
        const p1WinsShowdown: CFRNode = {
            id: id++,
            playerToAct: -1,
            actions: [],
            children: [],
            isTerminal: true,
            payoff: -50 // P1 wins half pot
        };

        // Terminal: P0 folds to bet
        const p0Folds: CFRNode = {
            id: id++,
            playerToAct: -1,
            actions: [],
            children: [],
            isTerminal: true,
            payoff: -50 // P0 loses half pot (folded)
        };

        // Terminal: P0 calls, showdown
        // Payoff depends on who has better hand - handled by CFR with hand info
        const showdownAfterCall: CFRNode = {
            id: id++,
            playerToAct: -1,
            actions: [],
            children: [],
            isTerminal: true,
            payoff: 0 // Placeholder - will be evaluated
        };

        // P0's decision after P1 bets
        const p0FacingBet: CFRNode = {
            id: id++,
            playerToAct: 0,
            actions: [
                { type: 'fold', amount: 0 },
                { type: 'call', amount: 100 }
            ],
            children: [p0Folds, showdownAfterCall],
            isTerminal: false
        };

        // Showdown after both check
        const showdownAfterChecks: CFRNode = {
            id: id++,
            playerToAct: -1,
            actions: [],
            children: [],
            isTerminal: true,
            payoff: 0 // Placeholder
        };

        // P1's decision (IP) after P0 checks
        const p1Decision: CFRNode = {
            id: id++,
            playerToAct: 1,
            actions: [
                { type: 'check', amount: 0 },
                { type: 'bet', amount: 100 }
            ],
            children: [showdownAfterChecks, p0FacingBet],
            isTerminal: false
        };

        return p1Decision;
    }

    it('should run CFR without errors', () => {
        const store = new InfosetStore();
        const root = createKuhnLikeTree();

        const strongHand: Card[] = [{ rank: 'A', suit: 'h' }, { rank: 'A', suit: 's' }];
        const weakHand: Card[] = [{ rank: '2', suit: 'h' }, { rank: '2', suit: 's' }];
        const board: Card[] = [
            { rank: 'K', suit: 'h' },
            { rank: 'Q', suit: 'h' },
            { rank: 'J', suit: 'h' },
            { rank: 'T', suit: 'h' },
            { rank: '9', suit: 'h' }
        ];

        // Run a few iterations
        for (let i = 0; i < 100; i++) {
            cfr(root, 1, 1, strongHand, weakHand, board, store);
            cfr(root, 1, 1, weakHand, strongHand, board, store);
        }

        expect(store.size).toBeGreaterThan(0);
    });

    it('should converge to value betting with strong hands', () => {
        const store = new InfosetStore();

        // Simplified tree: P1 can check or bet all-in
        // Create tree where showdown results are baked in
        let id = 0;

        // P0 has AA (strong), P1 has 22 (weak)
        // If showdown: P0 wins
        const showdownP0Wins: CFRNode = {
            id: id++, playerToAct: -1, actions: [], children: [],
            isTerminal: true, payoff: 50
        };

        // P0 folds
        const p0Folds: CFRNode = {
            id: id++, playerToAct: -1, actions: [], children: [],
            isTerminal: true, payoff: -50
        };

        // P0 calls with strong hand and wins
        const p0CallsAndWins: CFRNode = {
            id: id++, playerToAct: -1, actions: [], children: [],
            isTerminal: true, payoff: 100 // Wins bigger pot
        };

        // P0 decision when P1 bets
        const p0Decision: CFRNode = {
            id: id++,
            playerToAct: 0,
            actions: [{ type: 'fold', amount: 0 }, { type: 'call', amount: 100 }],
            children: [p0Folds, p0CallsAndWins],
            isTerminal: false
        };

        // P1's root decision
        const root: CFRNode = {
            id: id++,
            playerToAct: 1,
            actions: [{ type: 'check', amount: 0 }, { type: 'bet', amount: 100 }],
            children: [showdownP0Wins, p0Decision],
            isTerminal: false
        };

        const p0Cards: Card[] = [{ rank: 'A', suit: 'h' }, { rank: 'A', suit: 's' }];
        const p1Cards: Card[] = [{ rank: '2', suit: 'h' }, { rank: '2', suit: 's' }];
        const board: Card[] = [
            { rank: 'K', suit: 'h' }, { rank: 'Q', suit: 'h' },
            { rank: 'J', suit: 'h' }, { rank: 'T', suit: 'c' }, { rank: '9', suit: 'c' }
        ];

        // Run CFR
        const iterations = 10000;
        for (let i = 0; i < iterations; i++) {
            cfr(root, 1, 1, p0Cards, p1Cards, board, store);
        }

        // Get P1's strategy at root
        const strategy = getStrategy(store, root.id, p1Cards, board, 2);

        console.log('P1 strategy with weak hand (22):');
        console.log('  Check:', (strategy[0] * 100).toFixed(1) + '%');
        console.log('  Bet:', (strategy[1] * 100).toFixed(1) + '%');

        // P1 with weak hand should mostly check (not value bet into strong hand)
        // Since P0 has AA and will call and win, P1 should not bet
        expect(strategy[0]).toBeGreaterThan(0.5); // Should prefer check
    });

    it('should learn optimal calling frequency', () => {
        const store = new InfosetStore();

        let id = 0;

        // Scenario: P1 bets into P0
        // P0 must decide fold/call with a medium hand

        // P0 folds - loses 50
        const p0Folds: CFRNode = {
            id: id++, playerToAct: -1, actions: [], children: [],
            isTerminal: true, payoff: -50
        };

        // P0 calls and wins (P1 was bluffing)
        const p0CallsWins: CFRNode = {
            id: id++, playerToAct: -1, actions: [], children: [],
            isTerminal: true, payoff: 100
        };

        // P0 calls and loses (P1 had value)
        const p0CallsLoses: CFRNode = {
            id: id++, playerToAct: -1, actions: [], children: [],
            isTerminal: true, payoff: -100
        };

        // P0 decision facing bet (varies based on hand)
        const p0FacingBetMedium: CFRNode = {
            id: id++,
            playerToAct: 0,
            actions: [{ type: 'fold', amount: 0 }, { type: 'call', amount: 100 }],
            children: [p0Folds, p0CallsWins], // Assumes P0 wins at showdown
            isTerminal: false
        };

        // P1 decision at root
        const root: CFRNode = {
            id: id++,
            playerToAct: 1,
            actions: [
                { type: 'check', amount: 0 },
                { type: 'bet', amount: 100 }
            ],
            children: [
                // Check leads to showdown (P0 wins with medium hand)
                { id: id++, playerToAct: -1, actions: [], children: [], isTerminal: true, payoff: 50 },
                p0FacingBetMedium
            ],
            isTerminal: false
        };

        const p0Cards: Card[] = [{ rank: 'Q', suit: 'h' }, { rank: 'Q', suit: 's' }]; // Medium
        const p1Cards: Card[] = [{ rank: '7', suit: 'h' }, { rank: '2', suit: 's' }]; // Weak (bluff)
        const board: Card[] = [
            { rank: 'K', suit: 'h' }, { rank: 'J', suit: 'h' },
            { rank: 'T', suit: 'c' }, { rank: '5', suit: 'd' }, { rank: '3', suit: 's' }
        ];

        // Run CFR
        for (let i = 0; i < 5000; i++) {
            cfr(root, 1, 1, p0Cards, p1Cards, board, store);
        }

        // Get P0's calling strategy
        const p0Strategy = getStrategy(store, p0FacingBetMedium.id, p0Cards, board, 2);

        console.log('P0 strategy facing bet with QQ:');
        console.log('  Fold:', (p0Strategy[0] * 100).toFixed(1) + '%');
        console.log('  Call:', (p0Strategy[1] * 100).toFixed(1) + '%');

        // P0 should call frequently since they win at showdown
        expect(p0Strategy[1]).toBeGreaterThan(0.5);
    });
});

describe('River Tree Builder', () => {
    // Helper to create mock GameState
    function createMockGameState(
        potAmount: number,
        stack0: number,
        stack1: number,
        board: Card[],
        firstToAct: number, // 0 or 1
        bet0: number = 0,
        bet1: number = 0
    ): GameState {
        const players: Player[] = [
            {
                id: 'p0', seat: 0, name: 'P0', stack: stack0, bet: bet0, totalBet: bet0,
                status: 'active', holeCards: [], hasActed: false, actedOnStreet: false, startHandStack: 100
            },
            {
                id: 'p1', seat: 1, name: 'P1', stack: stack1, bet: bet1, totalBet: bet1,
                status: 'active', holeCards: [], hasActed: false, actedOnStreet: false, startHandStack: 100
            }
        ];

        return {
            config: { maxSeats: 2, smallBlind: 1, bigBlind: 2, ante: 0 },
            rngState: { seed: 0, state: 0 },
            deck: [],
            players,
            pots: [{ amount: potAmount, eligiblePlayers: ['p0', 'p1'] }],
            communityCards: board,
            street: 'river',
            dealerSeat: 1, // P1 is Dealer/IP
            actionSeat: firstToAct, // 0 or 1
            minRaise: 2,
            currentBet: Math.max(bet0, bet1),
            lastAggressor: null,
            lastRaiseIsFull: true
        };
    }

    it('should build a valid river tree', () => {
        const gameState = createMockGameState(100, 100, 100, [], 0);
        const tree = buildRiverTree(gameState, [0.5, 1.0], 2);

        expect(tree.isTerminal).toBe(false);
        expect(tree.playerToAct).toBe(0);
        expect(tree.actions.length).toBeGreaterThan(0);

        // Should have check action
        expect(tree.actions.some(a => a.type === 'check')).toBe(true);

        // Should have bet actions
        expect(tree.actions.some(a => a.type === 'bet')).toBe(true);
    });

    it('should create terminal nodes for folds', () => {
        const gameState = createMockGameState(100, 100, 100, [], 0);
        const tree = buildRiverTree(gameState, [1.0], 1);

        // P0 checks, P1 bets, P0 folds
        const p1Node = tree.children[0]; // After P0 checks
        expect(p1Node.playerToAct).toBe(1);

        const p0FacingBet = p1Node.children[1]; // After P1 bets
        expect(p0FacingBet.playerToAct).toBe(0);

        const foldNode = p0FacingBet.children[0]; // P0 folds
        expect(foldNode.isTerminal).toBe(true);
        expect(foldNode.payoff).toBeLessThan(0); // P0 loses
    });

    it('should handle mid-street solving (facing bet)', () => {
        // Scenario: P0 checked, P1 bet 50.
        // Now it's P0's turn to act.
        // Pot in middle was 100. P1 added 50.
        // Current Pot = 100 + 50 = 150?
        // In GameState, pots has 100. P1.bet = 50.

        const gameState = createMockGameState(100, 100, 50, [], 0, 0, 50);
        // stack1 was 100, bet 50 -> remaining stack 50.
        // stack0 is 100.

        const tree = buildRiverTree(gameState, [1.0], 1);

        // Root should be P0 facing a bet of 50
        expect(tree.playerToAct).toBe(0);

        // Actions should be Fold, Call, Raise (no Check, no Bet)
        const actionTypes = tree.actions.map(a => a.type);
        expect(actionTypes).toContain('fold');
        expect(actionTypes).toContain('call');
        expect(actionTypes).toContain('raise');
        expect(actionTypes).not.toContain('check');
        expect(actionTypes).not.toContain('bet');

        // Call amount should be 50
        const callAction = tree.actions.find(a => a.type === 'call');
        expect(callAction?.amount).toBe(50);
    });
});

describe('Full Kuhn-like Integration', () => {
    /**
     * Run a full Kuhn-like scenario with multiple hand matchups.
     *
     * Hands: A (strong), K (medium), Q (weak)
     * P1 acts after P0 checks.
     *
     * GTO expectations:
     * - P1 with A: Should bet for value
     * - P1 with K: Mixed strategy
     * - P1 with Q: Should mostly check (can't win at showdown vs better hands)
     */
    it('should learn differentiated strategies for different hand strengths', () => {
        const store = new InfosetStore();

        // Build simple check/bet tree
        let id = 0;

        const makeTree = (p0Wins: boolean): CFRNode => {
            const showdown: CFRNode = {
                id: id++, playerToAct: -1, actions: [], children: [],
                isTerminal: true, payoff: p0Wins ? 50 : -50
            };

            const p0Folds: CFRNode = {
                id: id++, playerToAct: -1, actions: [], children: [],
                isTerminal: true, payoff: -50
            };

            const showdownAfterCall: CFRNode = {
                id: id++, playerToAct: -1, actions: [], children: [],
                isTerminal: true, payoff: p0Wins ? 100 : -100
            };

            const p0Decision: CFRNode = {
                id: id++,
                playerToAct: 0,
                actions: [{ type: 'fold', amount: 0 }, { type: 'call', amount: 100 }],
                children: [p0Folds, showdownAfterCall],
                isTerminal: false
            };

            return {
                id: id++,
                playerToAct: 1,
                actions: [{ type: 'check', amount: 0 }, { type: 'bet', amount: 100 }],
                children: [showdown, p0Decision],
                isTerminal: false
            };
        };

        // Create trees for different matchups
        const treeP0Wins = makeTree(true);  // P0 has better hand
        const treeP1Wins = makeTree(false); // P1 has better hand

        const strongHand: Card[] = [{ rank: 'A', suit: 'h' }, { rank: 'A', suit: 's' }];
        const weakHand: Card[] = [{ rank: '2', suit: 'h' }, { rank: '2', suit: 's' }];
        const board: Card[] = [
            { rank: 'K', suit: 'c' }, { rank: 'Q', suit: 'c' },
            { rank: 'J', suit: 'c' }, { rank: 'T', suit: 'd' }, { rank: '9', suit: 'd' }
        ];

        // Run CFR alternating between matchups
        const iterations = 10000;
        for (let i = 0; i < iterations; i++) {
            // P0=strong, P1=weak -> P0 wins
            cfr(treeP0Wins, 1, 1, strongHand, weakHand, board, store);

            // P0=weak, P1=strong -> P1 wins
            cfr(treeP1Wins, 1, 1, weakHand, strongHand, board, store);
        }

        // Get P1's strategies for different hands
        const p1StrategyWeak = getStrategy(store, treeP0Wins.id, weakHand, board, 2);
        const p1StrategyStrong = getStrategy(store, treeP1Wins.id, strongHand, board, 2);

        console.log('\n=== Kuhn-like Integration Results ===');
        console.log('P1 with weak hand (22) vs strong:');
        console.log('  Check:', (p1StrategyWeak[0] * 100).toFixed(1) + '%');
        console.log('  Bet:', (p1StrategyWeak[1] * 100).toFixed(1) + '%');

        console.log('P1 with strong hand (AA) vs weak:');
        console.log('  Check:', (p1StrategyStrong[0] * 100).toFixed(1) + '%');
        console.log('  Bet:', (p1StrategyStrong[1] * 100).toFixed(1) + '%');

        // Verify GTO behavior
        // P1 should bet more with strong hands than weak hands
        expect(p1StrategyStrong[1]).toBeGreaterThan(p1StrategyWeak[1]);

        // P1 with strong hand should bet for value (>70%)
        expect(p1StrategyStrong[1]).toBeGreaterThan(0.7);

        // P1 with weak hand should check more often
        expect(p1StrategyWeak[0]).toBeGreaterThan(0.5);

        console.log('\nInfoset store stats:', store.stats);
    });
});
