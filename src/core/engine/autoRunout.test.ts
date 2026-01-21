import {
    createInitialState,
    applyAction,
    GameState,
    HandConfig,
    getTotalChips
} from '../index';

const createTestConfig = (seed: number = 12345): HandConfig => ({
    id: `test-hand-${seed}`,
    players: [
        { id: 'p1', name: 'Player 1', stack: 100, seat: 0 }, // BTN
        { id: 'p2', name: 'Player 2', stack: 100, seat: 1 }, // SB
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

describe('Auto Runout & Uncalled Bets', () => {
    it('auto-runs out to showdown when all players are all-in', () => {
        const config = createTestConfig();
        let state = createInitialState(config);

        // Heads up:
        // P1 (BTN/SB) posts 5. Stack 95.
        // P2 (BB) posts 10. Stack 90.
        // Action on P1.

        // P1 goes All-In (Raise to 100)
        // P1 puts in 95 (100 - 5). Stack 0.
        const p1Action = {
            street: state.street,
            playerId: 'p1',
            type: 'raise' as const,
            amount: 95, // Delta
            isAllIn: true,
            timestamp: Date.now()
        };
        state = applyAction(state, p1Action);

        expect(state.players[0].status).toBe('all-in');
        expect(state.currentBet).toBe(100);

        // P2 Calls All-In (Calls 90 more)
        // P2 puts in 90. Stack 0.
        const p2Action = {
            street: state.street,
            playerId: 'p2',
            type: 'call' as const,
            amount: 90,
            isAllIn: true,
            timestamp: Date.now()
        };
        state = applyAction(state, p2Action);

        // Expectation:
        // 1. Both players all-in.
        // 2. Street should be showdown.
        // 3. Community cards should be 5.
        expect(state.players[1].status).toBe('all-in');
        expect(state.street).toBe('showdown');
        expect(state.communityCards.length).toBe(5);
    });

    it('returns uncalled bet to aggressor', () => {
        const config = createTestConfig();
        // Modify stacks: P1 has 1000, P2 has 280
        config.players[0].stack = 1000;
        config.players[1].stack = 280;

        let state = createInitialState(config);

        // P1 (BTN/SB) posts 5. Stack 995.
        // P2 (BB) posts 10. Stack 270.

        // P1 Raises to 1000 (All-in)
        // Amount to add = 995.
        const p1Action = {
            street: state.street,
            playerId: 'p1',
            type: 'raise' as const,
            amount: 995,
            isAllIn: true,
            timestamp: Date.now()
        };
        state = applyAction(state, p1Action);

        // P2 Calls All-In (Calls 270 more, total 280)
        const p2Action = {
            street: state.street,
            playerId: 'p2',
            type: 'call' as const,
            amount: 270,
            isAllIn: true,
            timestamp: Date.now()
        };
        state = applyAction(state, p2Action);

        // Expectation:
        // P1 bet 1000. P2 bet 280.
        // Uncalled amount = 1000 - 280 = 720.
        // P1 should get 720 back.
        // Pot should be 280 + 280 = 560.
        // P1 Stack should be 720 (since he was 0 after all-in).

        expect(state.street).toBe('showdown'); // Auto-runout should also happen
        // Pot is resolved immediately, so pots are empty.
        // P1 should have at least 720 (returned uncalled bet).
        expect(state.players[0].stack).toBeGreaterThanOrEqual(720);

        // Check total chips conservation
        // Initial: 1000 + 280 = 1280.
        // Final: Pot(560) + P1(720) + P2(0) = 1280.
        const totalChips = state.pots.reduce((sum, p) => sum + p.amount, 0) +
            state.players.reduce((sum, p) => sum + p.stack, 0);
        expect(totalChips).toBe(1280);
    });
});
