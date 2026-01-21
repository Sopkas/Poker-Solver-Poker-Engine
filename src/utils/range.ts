export type HandType = 'pair' | 'suited' | 'offsuit';

export interface HandCell {
    hand: string; // "AKs", "AA", "AKo"
    type: HandType;
    row: number;
    col: number;
    combos: number; // 6 for pair, 4 for suited, 12 for offsuit
}

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

export const generateRangeGrid = (): HandCell[][] => {
    const grid: HandCell[][] = [];
    for (let i = 0; i < 13; i++) {
        const row: HandCell[] = [];
        for (let j = 0; j < 13; j++) {
            const rank1 = RANKS[i];
            const rank2 = RANKS[j];
            let hand = '';
            let type: HandType;
            let combos = 0;

            if (i === j) {
                hand = `${rank1}${rank2}`;
                type = 'pair';
                combos = 6;
            } else if (i < j) {
                hand = `${rank1}${rank2}s`;
                type = 'suited';
                combos = 4;
            } else {
                hand = `${rank2}${rank1}o`; // Offsuit: High card first
                type = 'offsuit';
                combos = 12;
            }
            row.push({ hand, type, row: i, col: j, combos });
        }
        grid.push(row);
    }
    return grid;
};
