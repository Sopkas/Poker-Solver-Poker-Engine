import { GameState, Player, Card } from '../types';

export class ConsistencyAudit {
    static checkInvariants(state: GameState): string[] {
        const errors: string[] = [];

        // 1. Stacks Non-Negative
        state.players.forEach(p => {
            if (p.stack < 0) errors.push(`Player ${p.id} has negative stack: ${p.stack}`);
        });

        // 2. Card Uniqueness
        const allCards = new Set<string>();
        const checkCard = (c: Card, loc: string) => {
            const s = `${c.rank}${c.suit}`;
            if (allCards.has(s)) errors.push(`Duplicate card ${s} found in ${loc}`);
            allCards.add(s);
        };

        state.communityCards.forEach((c, i) => checkCard(c, `Board[${i}]`));
        state.players.forEach(p => {
            p.holeCards.forEach((c, i) => checkCard(c, `Player ${p.id} Card ${i}`));
        });
        state.deck.forEach((c, i) => checkCard(c, `Deck[${i}]`));

        // 3. Conservation of Chips
        const stackSum = state.players.reduce((sum, p) => sum + p.stack, 0);
        const potSum = state.pots.reduce((sum, p) => sum + p.amount, 0);
        const betSum = state.players.reduce((sum, p) => sum + p.bet, 0);
        // Total should be constant (we can't check without knowing the starting amount)

        // 4. Action Seat Validity
        if (state.actionSeat >= 0) {
            const p = state.players.find(pl => pl.seat === state.actionSeat);
            if (!p) errors.push(`Action seat ${state.actionSeat} has no player`);
            else if (p.status === 'folded') errors.push(`Active player ${p.id} is folded`);
            else if (p.status === 'sitting-out') errors.push(`Active player ${p.id} is sitting out`);
        }

        return errors;
    }
}
