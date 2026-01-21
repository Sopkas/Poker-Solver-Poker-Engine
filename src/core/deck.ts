import { Card, Rank, Suit, PRNGState } from './types';
import { randomInt } from './prng';

const SUITS: Suit[] = ['h', 'd', 'c', 's'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

/**
 * Creates a standard 52-card deck.
 */
export const createDeck = (): Card[] => {
    const deck: Card[] = [];
    for (const s of SUITS) {
        for (const r of RANKS) {
            deck.push({ rank: r, suit: s });
        }
    }
    return deck;
};

/**
 * Shuffles a deck using the Fisher-Yates algorithm with the provided PRNG state.
 * This is a pure function: returns a NEW shuffled deck and the new PRNG state.
 */
export const shuffleDeck = (deck: Card[], rngState: PRNGState): { deck: Card[]; rngState: PRNGState } => {
    const newDeck = [...deck];
    let currentRng = rngState;

    for (let i = newDeck.length - 1; i > 0; i--) {
        const { value: j, nextState } = randomInt(currentRng, i + 1);
        currentRng = nextState;
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }

    return { deck: newDeck, rngState: currentRng };
};

/**
 * Draws N cards from the top of the deck.
 * Returns the drawn cards and the remaining deck.
 */
export const drawCards = (deck: Card[], count: number): { drawn: Card[]; remaining: Card[] } => {
    if (count > deck.length) throw new Error('Not enough cards in deck');
    return {
        drawn: deck.slice(0, count),
        remaining: deck.slice(count),
    };
};

/**
 * Parses a card string (e.g., "Ah", "Td") into a Card object.
 */
export const parseCard = (cardStr: string): Card => {
    if (cardStr.length !== 2) throw new Error(`Invalid card string: ${cardStr}`);
    const rank = cardStr[0] as Rank;
    const suit = cardStr[1] as Suit;
    if (!RANKS.includes(rank) || !SUITS.includes(suit)) {
        throw new Error(`Invalid card rank/suit: ${cardStr}`);
    }
    return { rank, suit };
};

/**
 * Stringifies a Card object (e.g., {rank: 'A', suit: 'h'} -> "Ah").
 */
export const formatCard = (card: Card): string => {
    return `${card.rank}${card.suit}`;
};
