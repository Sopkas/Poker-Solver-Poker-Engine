
export const getPositionNames = (playerCount: number): string[] => {
    switch (playerCount) {
        case 8: return ['BB', 'SB', 'UTG', 'UTG1', 'LJ', 'HJ', 'CO', 'BTN'];
        case 6: return ['BB', 'SB', 'UTG', 'HJ', 'CO', 'BTN'];
        case 5: return ['BB', 'SB', 'HJ', 'CO', 'BTN'];
        case 4: return ['BB', 'SB', 'CO', 'BTN'];
        case 3: return ['BB', 'SB', 'BTN'];
        case 2: return ['BB', 'SB']; // SB is BTN in HU
        default: return Array(playerCount).fill('Player');
    }
};

export const getPlayerPositionLabel = (seatIndex: number, dealerSeat: number, playerCount: number): string => {
    const names = getPositionNames(playerCount);
    const offset = (seatIndex - dealerSeat + playerCount) % playerCount;

    if (playerCount === 2) {
        // Heads-Up: Dealer is SB (Offset 0), Other is BB (Offset 1)
        if (offset === 0) return 'SB'; // Dealer
        return 'BB';
    }

    // 3+ Players
    if (offset === 0) return 'BTN';
    if (offset === 1) return 'SB';
    if (offset === 2) return 'BB';

    // For other positions (UTG, HJ, CO, etc.)
    // Mapping based on the array structure: ['BB', 'SB', 'UTG', ...]
    // Offset 3 -> UTG (Index 2)
    // Offset 4 -> HJ (Index 3)
    // ...
    // So index = offset - 1
    return names[offset - 1] || '';
};
