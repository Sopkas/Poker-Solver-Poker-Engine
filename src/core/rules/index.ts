import { GameState, Action, ActionType, Player, Pot, Street } from '../types';
import { isValidChipAmount } from '../validation';

// --- Types ---

export interface ActionError {
    code: string;
    message: string;
    expectedRange?: { min: number; max: number };
}

export interface LegalAction {
    type: ActionType;
    minAmount: number;
    maxAmount: number;
}

// --- Helper Functions ---

/**
 * Gets the player who is currently active (needs to act).
 */
export const getActivePlayer = (state: GameState): Player | undefined => {
    return state.players.find(p => p.seat === state.actionSeat);
};

/**
 * Finds the next active player seat clockwise from the given seat.
 * Active means status is 'active' (not folded, not all-in, not sitting-out).
 */
export const getNextActiveSeat = (state: GameState, fromSeat: number): number | null => {
    const maxSeats = state.config.maxSeats;
    let seat = (fromSeat + 1) % maxSeats;
    let checked = 0;

    while (checked < maxSeats) {
        const player = state.players.find(p => p.seat === seat);
        if (player && player.status === 'active') {
            return seat;
        }
        seat = (seat + 1) % maxSeats;
        checked++;
    }

    return null; // No active players found
};

/**
 * Gets the first active player seat left of the dealer (for post-flop action).
 */
export const getFirstToActSeat = (state: GameState): number | null => {
    return getNextActiveSeat(state, state.dealerSeat);
};

/**
 * Checks if this is the BB option scenario:
 * - Street is preflop
 * - Action is on BB
 * - No raises have occurred (lastAggressor is null)
 * - BB has matched the current bet (which is their own blind)
 */
export const isBBOption = (state: GameState): boolean => {
    if (state.street !== 'preflop') return false;
    if (state.lastAggressor !== null) return false;

    const player = getActivePlayer(state);
    if (!player) return false;

    // Find BB position (1 seat after SB, 2 after dealer typically)
    const activePlayers = state.players.filter(p => p.status === 'active' || p.status === 'all-in');
    if (activePlayers.length < 2) return false;

    // Check if current player has bet equal to BB and all others have acted
    // BB option: player.bet === state.currentBet and hasActed is false but everyone else has acted
    const playersWhoNeedToAct = state.players.filter(p =>
        p.status === 'active' && !p.hasActed && p.seat !== player.seat
    );

    return playersWhoNeedToAct.length === 0 && player.bet === state.currentBet && !player.hasActed;
};

/**
 * Counts players still in the hand (not folded).
 */
export const getPlayersInHand = (state: GameState): Player[] => {
    return state.players.filter(p => p.status === 'active' || p.status === 'all-in');
};

/**
 * Checks if only one player remains (everyone else folded).
 */
export const isSingleSurvivor = (state: GameState): boolean => {
    return getPlayersInHand(state).length === 1;
};

// --- Core Rules Functions ---

/**
 * Returns a list of legal actions with their valid amount ranges.
 * This is the primary function for determining what moves are allowed.
 */
export const getLegalActionsDetailed = (state: GameState): LegalAction[] => {
    // At showdown, only next-hand is allowed (for any player)
    if (state.street === 'showdown') {
        return [{ type: 'next-hand', minAmount: 0, maxAmount: 0 }];
    }

    const player = getActivePlayer(state);
    if (!player || player.status !== 'active') return [];

    const actions: LegalAction[] = [];
    const amountToCall = state.currentBet - player.bet;
    const stack = player.stack;

    // --- FOLD ---
    // Always legal when facing a bet (not when can check)
    if (amountToCall > 0) {
        actions.push({ type: 'fold', minAmount: 0, maxAmount: 0 });
    }

    // --- CHECK ---
    // Legal when player has matched current bet OR BB option
    if (amountToCall === 0 || isBBOption(state)) {
        actions.push({ type: 'check', minAmount: 0, maxAmount: 0 });
    }

    // --- CALL ---
    // Legal when there's a bet to call
    if (amountToCall > 0) {
        const callAmount = Math.min(stack, amountToCall);
        actions.push({ type: 'call', minAmount: callAmount, maxAmount: callAmount });
    }

    // --- BET ---
    // Legal when currentBet is 0 (no one has bet yet on this street)
    if (state.currentBet === 0 && stack > 0) {
        const minBet = Math.min(state.minRaise, stack); // Can always go all-in
        actions.push({ type: 'bet', minAmount: minBet, maxAmount: stack });
    }

    // --- RAISE ---
    // Legal when there's a bet to raise and player has chips beyond calling
    if (state.currentBet > 0 && stack > amountToCall) {
        // Check re-raise restriction:
        // If the last raise was incomplete (all-in < minRaise), players who have already acted
        // on this street cannot re-raise. They can only Call or Fold.
        // Exception: If they haven't acted yet on this street, they can still raise.
        const canRaise = state.lastRaiseIsFull || !player.actedOnStreet;

        if (canRaise) {
            // Min raise = currentBet + minRaise (additive)
            // The raise amount is total, so min total bet is currentBet + minRaise
            const minRaiseTotal = state.currentBet + state.minRaise;
            // Amount player needs to put in = minRaiseTotal - player.bet
            const minRaiseAmount = minRaiseTotal - player.bet;

            // Can always go all-in even if it's less than min raise
            const minAmount = Math.min(minRaiseAmount, stack);
            actions.push({ type: 'raise', minAmount, maxAmount: stack });
        }
    }

    return actions;
};

/**
 * Simplified getLegalActions returning just action types (for backwards compatibility).
 */
export const getLegalActions = (state: GameState): ActionType[] => {
    return getLegalActionsDetailed(state).map(a => a.type);
};

/**
 * Validates an action. Throws ActionError if illegal.
 */
export const validateAction = (state: GameState, action: Action): void => {
    // === CRITICAL: Validate amount is a valid integer ===
    // This prevents NaN, Infinity, negative, or fractional values from corrupting state
    if (!isValidChipAmount(action.amount)) {
        throw {
            code: 'INVALID_AMOUNT',
            message: `Amount must be a non-negative integer. Got: ${
                typeof action.amount === 'number'
                    ? (Number.isNaN(action.amount) ? 'NaN' : action.amount)
                    : typeof action.amount
            }`
        } as ActionError;
    }

    const player = state.players.find(p => p.id === action.playerId);
    if (!player) {
        throw { code: 'PLAYER_NOT_FOUND', message: 'Player not found' } as ActionError;
    }

    // Skip turn check for next-hand (anyone can trigger it, or UI restricts it)
    if (action.type !== 'next-hand' && player.seat !== state.actionSeat) {
        throw { code: 'WRONG_PLAYER', message: `Not this player's turn` } as ActionError;
    }

    if (player.status !== 'active' && action.type !== 'next-hand') {
        throw { code: 'PLAYER_NOT_ACTIVE', message: `Player is ${player.status}` } as ActionError;
    }

    const legalActions = getLegalActionsDetailed(state);
    const legalAction = legalActions.find(a => a.type === action.type);

    if (!legalAction) {
        const allowed = legalActions.map(a => a.type).join(', ');
        throw {
            code: 'ILLEGAL_ACTION_TYPE',
            message: `Action type ${action.type} is not allowed. Allowed: ${allowed}`
        } as ActionError;
    }

    // Validate amount
    if (action.type === 'fold' || action.type === 'check') {
        if (action.amount !== 0) {
            throw { code: 'INVALID_AMOUNT', message: 'Fold/Check amount must be 0' } as ActionError;
        }
    } else if (action.type === 'call') {
        const expectedCall = legalAction.minAmount;
        // Call amount should match expected (or be all-in for less)
        if (action.amount > expectedCall) {
            throw { code: 'INVALID_CALL_AMOUNT', message: `Call amount exceeds required` } as ActionError;
        }
        if (action.amount < expectedCall && !action.isAllIn) {
            throw { code: 'INVALID_CALL_AMOUNT', message: `Call amount less than required` } as ActionError;
        }
    } else if (action.type === 'bet' || action.type === 'raise') {
        if (action.amount > legalAction.maxAmount) {
            throw {
                code: 'INSUFFICIENT_FUNDS',
                message: `Amount exceeds stack`,
                expectedRange: { min: legalAction.minAmount, max: legalAction.maxAmount }
            } as ActionError;
        }

        // Allow all-in for less than min
        if (action.amount < legalAction.minAmount && !action.isAllIn) {
            throw {
                code: 'INVALID_RAISE_AMOUNT',
                message: `Amount is less than minimum`,
                expectedRange: { min: legalAction.minAmount, max: legalAction.maxAmount }
            } as ActionError;
        }
    }
};

/**
 * Calculates side pots based on player bets.
 * Called at end of street to properly distribute chips.
 */
export const resolveSidePots = (players: Player[]): Pot[] => {
    const playersWithBets = players.filter(p => p.bet > 0);
    if (playersWithBets.length === 0) return [];

    const pots: Pot[] = [];
    let lastLevel = 0;

    // Get unique bet levels, sorted ascending
    const betLevels = Array.from(new Set(playersWithBets.map(p => p.bet))).sort((a, b) => a - b);

    for (const level of betLevels) {
        const contribution = level - lastLevel;
        if (contribution <= 0) continue;

        const pot: Pot = { amount: 0, eligiblePlayers: [] };

        for (const player of players) {
            if (player.bet >= level) {
                pot.amount += contribution;
                // Only non-folded players are eligible to win
                if (player.status !== 'folded') {
                    pot.eligiblePlayers.push(player.id);
                }
            } else if (player.bet > lastLevel) {
                // Partial contribution
                const partial = player.bet - lastLevel;
                pot.amount += partial;
                if (player.status !== 'folded') {
                    pot.eligiblePlayers.push(player.id);
                }
            }
        }

        if (pot.amount > 0) {
            pots.push(pot);
        }
        lastLevel = level;
    }

    return pots;
};

/**
 * Checks if betting action is complete for the current street.
 * 
 * Street ends when:
 * 1. All active players have acted AND matched the current bet
 * 2. OR only one player remains
 * 3. OR all active players are all-in
 */
export const isStreetComplete = (state: GameState): boolean => {
    const activePlayers = state.players.filter(p => p.status === 'active');
    const playersInHand = getPlayersInHand(state);

    // Single survivor
    if (playersInHand.length <= 1) {
        return true;
    }

    // All remaining players are all-in (no more action possible)
    if (activePlayers.length === 0) {
        return true;
    }

    // Check if everyone has acted and matched
    for (const player of activePlayers) {
        if (!player.hasActed) return false;
        if (player.bet !== state.currentBet) return false;
    }

    return true;
};

/**
 * Determines the next street.
 */
export const getNextStreet = (currentStreet: Street): Street => {
    switch (currentStreet) {
        case 'preflop': return 'flop';
        case 'flop': return 'turn';
        case 'turn': return 'river';
        case 'river': return 'showdown';
        default: return 'showdown';
    }
};

// --- Exports ---

export const Rules = {
    getActivePlayer,
    getNextActiveSeat,
    getFirstToActSeat,
    getLegalActions,
    getLegalActionsDetailed,
    validateAction,
    resolveSidePots,
    isStreetComplete,
    getNextStreet,
    isBBOption,
    isSingleSurvivor,
    getPlayersInHand,
};
