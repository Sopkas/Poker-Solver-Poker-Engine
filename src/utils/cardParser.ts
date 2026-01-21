import { Card, Rank, Suit } from '../core/types';

/**
 * Parses a string representation of cards into Card objects.
 * Supported formats: "AhKh", "Ah Kh", "Ah,Kh", "Tc9d"
 * 
 * @param input String containing card codes (e.g. "AhKh")
 * @returns Array of Card objects
 * @throws Error if invalid format
 */
export const parseCards = (input: string): Card[] => {
    // Remove whitespace and commas
    const cleanInput = input.replace(/[\s,]/g, '');

    if (cleanInput.length % 2 !== 0) {
        throw new Error('Invalid card string length');
    }

    const cards: Card[] = [];

    for (let i = 0; i < cleanInput.length; i += 2) {
        const rankChar = cleanInput[i].toUpperCase();
        const suitChar = cleanInput[i + 1].toLowerCase();

        if (!isValidRank(rankChar)) {
            throw new Error(`Invalid rank: ${rankChar}`);
        }
        if (!isValidSuit(suitChar)) {
            throw new Error(`Invalid suit: ${suitChar}`);
        }

        cards.push({
            rank: rankChar as Rank,
            suit: suitChar as Suit
        });
    }

    return cards;
};

const isValidRank = (char: string): boolean => {
    return ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'].includes(char);
};

const isValidSuit = (char: string): boolean => {
    return ['h', 'd', 'c', 's'].includes(char);
};
