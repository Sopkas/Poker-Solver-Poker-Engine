
import { createInitialState, Engine } from './index';
import { HandConfig, ScenarioConfig } from '../types';

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

describe('Showdown and Next Hand', () => {
    test('Should resolve showdown and allow next hand', () => {
        // Setup: Hero (AA) vs Villain (KK). Villain has more chips to survive.
        const config = createConfig([
            { id: 'Hero', name: 'Hero', stack: 1000, seat: 0 },
            { id: 'Villain', name: 'Villain', stack: 2000, seat: 1 }
        ]);

        const scenario: ScenarioConfig = {
            numPlayers: 2,
            smallBlind: 10,
            bigBlind: 20,
            startingStack: 1000,
            heroSeat: 0,
            players: [
                { seat: 0, cards: [{ rank: 'A', suit: 's' }, { rank: 'A', suit: 'd' }] },
                { seat: 1, cards: [{ rank: 'K', suit: 's' }, { rank: 'K', suit: 'd' }] }
            ]
        };

        let state = createInitialState(config, scenario);

        // Preflop: Hero (SB) raises All-In (1000), Villain (BB) calls (1000).
        state = Engine.applyAction(state, { type: 'raise', amount: 990, playerId: 'Hero', street: 'preflop', isAllIn: true, timestamp: 0 });
        state = Engine.applyAction(state, { type: 'call', amount: 980, playerId: 'Villain', street: 'preflop', isAllIn: false, timestamp: 0 });

        // Should auto-run to Showdown
        expect(state.street).toBe('showdown');

        // Winners should be populated
        expect(state.winners).toBeDefined();
        expect(state.winners?.length).toBeGreaterThan(0);

        const winner = state.winners![0];
        console.log('Winner:', winner.playerId, 'Amount:', winner.amount, 'Hand:', winner.handRank);

        // Verify chips moved
        const hero = state.players.find(p => p.id === 'Hero');
        const villain = state.players.find(p => p.id === 'Villain');

        // Total chips should be conserved (3000)
        expect((hero?.stack || 0) + (villain?.stack || 0)).toBe(3000);

        // Winner should have 2000 (Hero started with 1000, doubled up)
        // Villain should have 1000 left
        const winnerPlayer = state.players.find(p => p.id === winner.playerId);

        if (winner.playerId === 'Hero') {
            expect(winnerPlayer?.stack).toBe(2000);
            expect(villain?.stack).toBe(1000);
        } else {
            // If Villain won, he has 3000 (2000 start + 1000 win)
            expect(winnerPlayer?.stack).toBe(3000);
            expect(hero?.stack).toBe(0);
        }

        // Start Next Hand
        // If Hero lost, he is busted and cannot start next hand (unless we allow it and he is removed?)
        // If Hero lost, players.length < 2, so prepareNextHand will throw.
        // So we only test next-hand if Hero won or if we handle the throw.

        if (winner.playerId === 'Hero') {
            state = Engine.applyAction(state, { type: 'next-hand', amount: 0, playerId: 'Hero', street: 'showdown', isAllIn: false, timestamp: 0 });

            // Verify new hand state
            expect(state.street).toBe('preflop');
            expect(state.dealerSeat).toBe(1); // Dealer rotated
            expect(state.pots.length).toBe(1);
            expect(state.pots[0].amount).toBe(0); // Pot empty (blinds in bets)
        }
    });

    test('Should handle Next Hand with sufficient players', () => {
        // Setup: 3 players, deep stacks.
        const config = createConfig([
            { id: 'P1', name: 'P1', stack: 1000, seat: 0 },
            { id: 'P2', name: 'P2', stack: 1000, seat: 1 },
            { id: 'P3', name: 'P3', stack: 1000, seat: 2 }
        ]);

        let state = createInitialState(config);

        // Fold around to BB (P2)
        state = Engine.applyAction(state, { type: 'fold', amount: 0, playerId: 'P1', street: 'preflop', isAllIn: false, timestamp: 0 });
        state = Engine.applyAction(state, { type: 'fold', amount: 0, playerId: 'P2', street: 'preflop', isAllIn: false, timestamp: 0 });

        // P3 wins (single survivor)
        expect(state.street).toBe('showdown');
        expect(state.winners).toBeDefined();
        expect(state.winners![0].playerId).toBe('P3');

        // Next Hand
        state = Engine.applyAction(state, { type: 'next-hand', amount: 0, playerId: 'P3', street: 'showdown', isAllIn: false, timestamp: 0 });

        expect(state.street).toBe('preflop');
        expect(state.dealerSeat).toBe(1); // Rotated from 0 to 1
    });
});
