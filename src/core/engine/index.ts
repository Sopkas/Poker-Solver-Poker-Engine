/**
 * Engine Module - State Transitions
 *
 * Pure functions for advancing poker game state deterministically.
 * All functions return NEW state objects, never mutating input.
 */

import { GameState, Action, Player, Pot, Card, Street } from '../types';
import { drawCards } from '../deck';
import {
    Rules,
    validateAction,
    resolveSidePots,
    getNextActiveSeat,
    getFirstToActSeat,
    isStreetComplete,
    getNextStreet,
    isSingleSurvivor,
    getPlayersInHand,
} from '../rules';
import { resolveShowdown, resolveSingleWinner } from '../showdown';
import { prepareNextHand } from '../state';

// Re-export state factory for backwards compatibility
export { createInitialState, getTotalChips, checkCardUniqueness } from '../state';

// --- Helper Functions ---

/**
 * Deep clones players array (shallow clone each player object).
 */
const clonePlayers = (players: Player[]): Player[] => {
    return players.map(p => ({ ...p, holeCards: [...p.holeCards] }));
};

/**
 * Deep clones pots array.
 */
const clonePots = (pots: Pot[]): Pot[] => {
    return pots.map(p => ({ ...p, eligiblePlayers: [...p.eligiblePlayers] }));
};

/**
 * Creates a shallow clone of GameState with cloned mutable nested objects.
 */
const cloneState = (state: GameState): GameState => {
    return {
        ...state,
        deck: [...state.deck],
        players: clonePlayers(state.players),
        pots: clonePots(state.pots),
        communityCards: [...state.communityCards],
        rngState: { ...state.rngState },
    };
};

// --- Core Engine Functions ---

/**
 * Applies an action to the game state and returns a new state.
 * This is the primary state transition function.
 *
 * @param state - Current immutable game state
 * @param action - Action to apply
 * @returns New game state after action
 * @throws ActionError if action is invalid
 */
export const applyAction = (state: GameState, action: Action): GameState => {
    // Validate action first
    validateAction(state, action);

    // Clone state for immutability
    let newState = cloneState(state);

    // Find the acting player
    const playerIndex = newState.players.findIndex(p => p.id === action.playerId);
    const player = newState.players[playerIndex];

    // Apply action based on type
    switch (action.type) {
        case 'fold':
            player.status = 'folded';
            player.hasActed = true;
            player.actedOnStreet = true;
            break;

        case 'check':
            player.hasActed = true;
            player.actedOnStreet = true;
            break;

        case 'call': {
            const callAmount = Math.min(player.stack, state.currentBet - player.bet);
            player.stack -= callAmount;
            player.bet += callAmount;
            player.totalBet += callAmount;
            player.hasActed = true;
            player.actedOnStreet = true;

            // Check if player went all-in
            if (player.stack === 0) {
                player.status = 'all-in';
            }
            break;
        }

        case 'bet': {
            const betAmount = action.amount;
            player.stack -= betAmount;
            player.bet += betAmount;
            player.totalBet += betAmount;
            player.hasActed = true;
            player.actedOnStreet = true;

            // Update aggression tracking
            newState.currentBet = player.bet;
            newState.lastAggressor = player.seat;
            newState.minRaise = betAmount; // Next min raise is this bet amount
            newState.lastRaiseIsFull = true; // Bet is always a full opening

            // Reset hasActed for other active players (they need to respond)
            newState.players.forEach(p => {
                if (p.id !== player.id && p.status === 'active') {
                    p.hasActed = false;
                }
            });

            // Check if player went all-in
            if (player.stack === 0) {
                player.status = 'all-in';
            }
            break;
        }

        case 'raise': {
            const raiseAmount = action.amount; // Amount player is putting in
            player.stack -= raiseAmount;
            player.bet += raiseAmount;
            player.totalBet += raiseAmount;
            player.hasActed = true;
            player.actedOnStreet = true;

            // Calculate the raise increment (how much above current bet)
            const raiseIncrement = player.bet - state.currentBet;

            // Update aggression tracking
            newState.currentBet = player.bet;
            newState.lastAggressor = player.seat;

            // Check if this is a full raise
            // A raise is full if the increment is >= current minRaise
            const isFullRaise = raiseIncrement >= state.minRaise;
            newState.lastRaiseIsFull = isFullRaise;

            // Min raise for next player = this raise increment (additive)
            // Only update if this is a legal raise (not a short all-in)
            if (isFullRaise || action.isAllIn) {
                newState.minRaise = Math.max(raiseIncrement, state.minRaise);
            }

            // Reset hasActed for other active players (they need to respond)
            newState.players.forEach(p => {
                if (p.id !== player.id && p.status === 'active') {
                    p.hasActed = false;
                }
            });

            if (player.stack === 0) {
                player.status = 'all-in';
            }
            break;
        }

        case 'next-hand': {
            // Can only start next hand if current hand is over (showdown)
            if (state.street !== 'showdown') {
                throw { code: 'GAME_NOT_OVER', message: 'Cannot start next hand before showdown' };
            }
            return prepareNextHand(state);
        }
    }

    // Check for single survivor (everyone else folded)
    if (isSingleSurvivor(newState)) {
        // Hand ends immediately - transition to showdown
        newState = collectBets(newState);
        newState.street = 'showdown';
        // Resolve the single winner immediately
        return resolveSingleWinner(newState);
    }

    // Check if street is complete
    if (isStreetComplete(newState)) {
        newState = advanceStreet(newState);

        // Check for auto-runout (all-in situations)
        const activePlayers = newState.players.filter(p => p.status !== 'folded');
        const playersAbleToBet = activePlayers.filter(p => p.status !== 'all-in');

        if (activePlayers.length > 1 && playersAbleToBet.length <= 1 && newState.street !== 'showdown') {
            newState = runOutBoard(newState);
        }
    } else {
        // Advance to next player
        const nextSeat = getNextActiveSeat(newState, player.seat);
        if (nextSeat !== null) {
            newState.actionSeat = nextSeat;
        }
    }

    return newState;
};

/**
 * Collects all current bets into pots.
 * Returns new state with bets moved to pots and player.bet reset.
 */
const collectBets = (state: GameState): GameState => {
    const newState = cloneState(state);

    // Calculate new pots from current bets
    const newPots = resolveSidePots(newState.players);

    // Filter out uncalled bets and return them to players
    const validPots: Pot[] = [];
    for (const pot of newPots) {
        if (pot.eligiblePlayers.length === 1) {
            // Uncalled bet - return to player
            const playerId = pot.eligiblePlayers[0];
            const player = newState.players.find(p => p.id === playerId);
            if (player) {
                player.stack += pot.amount;
            }
        } else {
            validPots.push(pot);
        }
    }

    // Merge new pots with existing pots
    if (validPots.length > 0) {
        // Add new pot amounts to existing pots or create new ones
        if (newState.pots.length > 0) {
            // Merge main pot (first pot)
            newState.pots[0].amount += validPots[0].amount;

            // Add any side pots
            for (let i = 1; i < validPots.length; i++) {
                newState.pots.push(validPots[i]);
            }
        } else {
            newState.pots = validPots;
        }
    }

    // Reset player bets
    newState.players.forEach(p => {
        p.bet = 0;
    });

    return newState;
};

/**
 * Advances to the next street after betting is complete.
 * Handles pot collection, card dealing, and state reset.
 *
 * @param state - Current state (betting complete)
 * @returns New state for next street
 */
const advanceStreet = (state: GameState): GameState => {
    let newState = cloneState(state);

    // 1. Collect bets into pots
    newState = collectBets(newState);

    // 2. Determine next street
    const nextStreet = getNextStreet(state.street);
    newState.street = nextStreet;

    // If going to showdown, no cards to deal
    if (nextStreet === 'showdown') {
        // Resolve showdown immediately upon transition
        return resolveShowdown(newState);
    }

    // 3. Deal community cards (if not showdown)
    let currentDeck = [...newState.deck];
    let currentRng = { ...newState.rngState };

    // Burn 1 card
    const burnResult = drawCards(currentDeck, 1);
    currentDeck = burnResult.remaining;

    // Deal community cards
    let cardsToDeal = 0;
    switch (nextStreet) {
        case 'flop':
            cardsToDeal = 3;
            break;
        case 'turn':
        case 'river':
            cardsToDeal = 1;
            break;
    }

    if (cardsToDeal > 0) {
        const dealResult = drawCards(currentDeck, cardsToDeal);
        newState.communityCards = [...newState.communityCards, ...dealResult.drawn];
        newState.deck = dealResult.remaining;
    }

    // RNG state doesn't change here because we're not shuffling
    // The cards are already in deterministic order from initial shuffle

    // 4. Reset betting state
    newState.currentBet = 0;
    newState.minRaise = state.config.bigBlind;
    newState.lastAggressor = null;
    newState.lastRaiseIsFull = true;

    // Reset hasActed for all active players
    newState.players.forEach(p => {
        if (p.status === 'active') {
            p.hasActed = false;
            p.actedOnStreet = false;
        }
    });

    // 5. Set action to first player (left of dealer)
    const firstToAct = getFirstToActSeat(newState);
    if (firstToAct !== null) {
        newState.actionSeat = firstToAct;
    }

    return newState;
};

/**
 * Fast-forwards through remaining streets when only all-in players remain.
 * Deals all remaining community cards without betting rounds.
 */
export const runOutBoard = (state: GameState): GameState => {
    let newState = cloneState(state);

    // Collect any remaining bets
    newState = collectBets(newState);

    // Deal remaining community cards
    let currentDeck = [...newState.deck];

    // Determine how many cards to deal
    const currentCommunity = newState.communityCards.length;

    if (currentCommunity < 3) {
        // Deal flop (burn + 3)
        const burn1 = drawCards(currentDeck, 1);
        currentDeck = burn1.remaining;
        const flop = drawCards(currentDeck, 3);
        currentDeck = flop.remaining;
        newState.communityCards = [...newState.communityCards, ...flop.drawn];
    }

    if (newState.communityCards.length < 4) {
        // Deal turn (burn + 1)
        const burn2 = drawCards(currentDeck, 1);
        currentDeck = burn2.remaining;
        const turn = drawCards(currentDeck, 1);
        currentDeck = turn.remaining;
        newState.communityCards = [...newState.communityCards, ...turn.drawn];
    }

    if (newState.communityCards.length < 5) {
        // Deal river (burn + 1)
        const burn3 = drawCards(currentDeck, 1);
        currentDeck = burn3.remaining;
        const river = drawCards(currentDeck, 1);
        currentDeck = river.remaining;
        newState.communityCards = [...newState.communityCards, ...river.drawn];
    }

    newState.deck = currentDeck;
    newState.street = 'showdown';

    // Resolve showdown immediately
    return resolveShowdown(newState);
};

// --- Exports ---

export const Engine = {
    applyAction,
    runOutBoard,
    advanceStreet,
};
