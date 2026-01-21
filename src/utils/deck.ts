import { Card, Rank, Suit } from '../core/types';
import seedrandom from 'seedrandom';

const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS: Suit[] = ['h', 'd', 'c', 's'];

/**
 * Creates a standard 52-card deck.
 */
export function createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ rank, suit });
        }
    }
    return deck;
}

/**
 * Shuffles a deck using the Fisher-Yates algorithm with a seeded RNG.
 * @param deck The deck to shuffle.
 * @param seed Optional seed for deterministic shuffling. If not provided, Math.random is used.
 */
export function shuffleDeck(deck: Card[], seed?: string): Card[] {
    const newDeck = [...deck];
    const rng = seed ? seedrandom(seed) : Math.random;

    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
}

/**
 * Parses a card string (e.g., "Ah", "Td") into a Card object.
 */
export function parseCard(cardStr: string): Card {
    if (cardStr.length !== 2) throw new Error(`Invalid card string: ${cardStr}`);
    const rank = cardStr[0] as Rank;
    const suit = cardStr[1] as Suit;
    if (!RANKS.includes(rank) || !SUITS.includes(suit)) {
        throw new Error(`Invalid card rank/suit: ${cardStr}`);
    }
    return { rank, suit };
}

/**
 * Stringifies a Card object (e.g., {rank: 'A', suit: 'h'} -> "Ah").
 */
export function formatCard(card: Card): string {
    return `${card.rank}${card.suit}`;
}
