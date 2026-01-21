import { createInitialState, Engine } from '../index';
import { buildTree } from './treeBuilder';
import { TreeConfig, SolverNode } from './types';
import { GameState } from '../types';

describe('Game Tree Builder', () => {
    // Helper to advance to River
    const setupRiverState = (): GameState => {
        const config = {
            id: 'test-hand',
            players: [
                { id: 'A', name: 'A', stack: 1000, seat: 0 },
                { id: 'B', name: 'B', stack: 1000, seat: 1 }
            ],
            tableConfig: { maxSeats: 6, smallBlind: 5, bigBlind: 10, ante: 0 },
            dealerSeat: 0,
            seed: 12345
        };

        let state = createInitialState(config);

        // Preflop: SB(A) posts 5, BB(B) posts 10.
        // A calls 5.
        state = Engine.applyAction(state, { type: 'call', amount: 5, playerId: 'A', street: 'preflop', isAllIn: false, timestamp: 0 });
        // B checks.
        state = Engine.applyAction(state, { type: 'check', amount: 0, playerId: 'B', street: 'preflop', isAllIn: false, timestamp: 0 });

        // Flop
        // B checks (BB acts first postflop in HU)
        state = Engine.applyAction(state, { type: 'check', amount: 0, playerId: 'B', street: 'flop', isAllIn: false, timestamp: 0 });
        // A checks.
        state = Engine.applyAction(state, { type: 'check', amount: 0, playerId: 'A', street: 'flop', isAllIn: false, timestamp: 0 });

        // Turn
        // B checks.
        state = Engine.applyAction(state, { type: 'check', amount: 0, playerId: 'B', street: 'turn', isAllIn: false, timestamp: 0 });
        // A checks.
        state = Engine.applyAction(state, { type: 'check', amount: 0, playerId: 'A', street: 'turn', isAllIn: false, timestamp: 0 });

        // River
        return state;
    };

    test('Builds a simple River tree', () => {
        const state = setupRiverState();
        expect(state.street).toBe('river');

        // On River, B (BB) acts first.
        expect(state.actionSeat).toBe(1); // B

        const config: TreeConfig = {
            betSizes: {
                flop: [0.5],
                turn: [0.5],
                river: [0.5] // Bet 50% pot
            },
            maxRaises: 2
        };

        const root = buildTree(state, config);

        // Analyze Root (B acts)
        expect(root.type).toBe('action');
        expect(root.activePlayer).toBe(1); // B

        // B can Check or Bet
        const checkEdge = root.children.find(c => c.action.type === 'check');
        const betEdge = root.children.find(c => c.action.type === 'bet');

        expect(checkEdge).toBeDefined();
        expect(betEdge).toBeDefined();

        // Analyze Check Path -> A acts
        const nodeAfterCheck = checkEdge!.nextNode;
        expect(nodeAfterCheck.type).toBe('action');
        expect(nodeAfterCheck.activePlayer).toBe(0); // A

        // A can Check or Bet
        const aCheck = nodeAfterCheck.children.find(c => c.action.type === 'check');
        const aBet = nodeAfterCheck.children.find(c => c.action.type === 'bet');

        expect(aCheck).toBeDefined();
        expect(aBet).toBeDefined();

        // A Check -> Showdown
        const nodeShowdown = aCheck!.nextNode;
        expect(nodeShowdown.type).toBe('showdown');

        // Analyze Bet Path -> A acts
        const nodeAfterBet = betEdge!.nextNode;
        // Pot was 20. Bet 10.
        expect(betEdge!.action.amount).toBe(10);

        // A can Fold, Call, Raise
        const aFold = nodeAfterBet.children.find(c => c.action.type === 'fold');
        const aCall = nodeAfterBet.children.find(c => c.action.type === 'call');
        const aRaise = nodeAfterBet.children.find(c => c.action.type === 'raise');

        expect(aFold).toBeDefined();
        expect(aCall).toBeDefined();
        expect(aRaise).toBeDefined();

        // A Raise -> B acts
        const nodeAfterRaise = aRaise!.nextNode;
        expect(nodeAfterRaise.activePlayer).toBe(1); // B

        // B can Fold, Call. No Raise (maxRaises=1 reached? Bet->Raise is 1 raise?)
        // Wait, "raisesInStreet" logic:
        // Bet -> 1?
        // Raise -> 2?
        // If maxRaises=1.
        // Root (0) -> Bet (1).
        // NodeAfterBet (1).
        // Raise (2).
        // NodeAfterRaise (2).
        // Next actions: raisesInStreet is 2. 2 < 1 is false.
        // So B cannot raise.

        const bRaise = nodeAfterRaise.children.find(c => c.action.type === 'raise');
        expect(bRaise).toBeUndefined();

        const bCall = nodeAfterRaise.children.find(c => c.action.type === 'call');
        expect(bCall).toBeDefined();
        expect(bCall!.nextNode.type).toBe('showdown');
    });
});
