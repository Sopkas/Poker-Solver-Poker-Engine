/**
 * Showdown Resolution Module
 * 
 * Pure functions for determining winners and distributing pot chips.
 * Handles split pots, side pots, and odd chip distribution.
 * 
 * Odd Chip Rule: First player clockwise from dealer gets the extra chip.
 */

import { GameState, Player, Pot, Card, ShowdownResult } from '../types';
import { evaluate, HandEvaluation, getHandName } from '../evaluator';

// --- Types ---

export interface PotWinResult {
    potIndex: number;
    potAmount: number;
    winners: {
        playerId: string;
        amount: number;
        handRank: string;
        score: number;
        bestHand: Card[];
    }[];
}

// --- Helper Functions ---

/**
 * Deep clones players array.
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
 * Gets player hand evaluation for showdown.
 */
const getPlayerEvaluation = (
    player: Player,
    communityCards: Card[]
): HandEvaluation | null => {
    if (player.holeCards.length < 2) return null;
    if (communityCards.length < 5) return null;

    const allCards = [...player.holeCards, ...communityCards];
    return evaluate(allCards);
};

/**
 * Calculates seat distance clockwise from dealer.
 * Used for odd chip distribution (lower distance = closer to dealer's left).
 */
const getSeatDistance = (seat: number, dealerSeat: number, maxSeats: number): number => {
    return (seat - dealerSeat + maxSeats) % maxSeats;
};

/**
 * Resolves a single pot and returns winner information.
 */
const resolvePot = (
    pot: Pot,
    potIndex: number,
    players: Player[],
    communityCards: Card[],
    dealerSeat: number,
    maxSeats: number
): PotWinResult => {
    // Get eligible players who haven't folded
    const eligiblePlayers = players.filter(p =>
        pot.eligiblePlayers.includes(p.id) && p.status !== 'folded'
    );

    if (eligiblePlayers.length === 0) {
        // No eligible players - should not happen in valid game
        return { potIndex, potAmount: pot.amount, winners: [] };
    }

    if (eligiblePlayers.length === 1) {
        // Single eligible player wins everything
        const player = eligiblePlayers[0];
        const evaluation = getPlayerEvaluation(player, communityCards);
        return {
            potIndex,
            potAmount: pot.amount,
            winners: [{
                playerId: player.id,
                amount: pot.amount,
                handRank: evaluation ? getHandName(evaluation) : 'Unknown',
                score: evaluation?.score ?? 0,
                bestHand: evaluation?.bestHand ?? []
            }]
        };
    }

    // Evaluate all eligible players
    const evaluations: { player: Player; eval: HandEvaluation }[] = [];
    for (const player of eligiblePlayers) {
        const evaluation = getPlayerEvaluation(player, communityCards);
        if (evaluation) {
            evaluations.push({ player, eval: evaluation });
        }
    }

    if (evaluations.length === 0) {
        return { potIndex, potAmount: pot.amount, winners: [] };
    }

    // Find highest score
    const maxScore = Math.max(...evaluations.map(e => e.eval.score));

    // Get all players with the highest score (tie = split pot)
    const winners = evaluations.filter(e => e.eval.score === maxScore);

    // Calculate chip distribution
    const baseAmount = Math.floor(pot.amount / winners.length);
    const oddChips = pot.amount % winners.length;

    // Sort winners by seat distance from dealer (for odd chip distribution)
    const sortedWinners = [...winners].sort((a, b) => {
        const distA = getSeatDistance(a.player.seat, dealerSeat, maxSeats);
        const distB = getSeatDistance(b.player.seat, dealerSeat, maxSeats);
        return distA - distB;
    });

    // Distribute chips (first N winners get odd chips)
    const winnerResults = sortedWinners.map((w, index) => ({
        playerId: w.player.id,
        amount: baseAmount + (index < oddChips ? 1 : 0),
        handRank: getHandName(w.eval),
        score: w.eval.score,
        bestHand: w.eval.bestHand
    }));

    return { potIndex, potAmount: pot.amount, winners: winnerResults };
};

// --- Public API ---

/**
 * Resolves the showdown and distributes all pots to winners.
 * Returns a new GameState with updated player stacks and cleared pots.
 * 
 * @param state - Current game state at showdown
 * @returns New GameState with pot distributions applied
 */
export const resolveShowdown = (state: GameState): GameState => {
    // Validate we're at showdown
    if (state.street !== 'showdown') {
        throw new Error('Cannot resolve showdown: not at showdown street');
    }

    if (state.communityCards.length < 5) {
        throw new Error('Cannot resolve showdown: need 5 community cards');
    }

    // Clone state for immutability
    const newPlayers = clonePlayers(state.players);

    // Track pot results for ShowdownResult
    const allWinners: ShowdownResult['winners'] = [];
    const allRanks: ShowdownResult['ranks'] = [];

    // Build ranks for all non-folded players
    for (const player of newPlayers) {
        if (player.status !== 'folded' && player.holeCards.length >= 2) {
            const evaluation = getPlayerEvaluation(player, state.communityCards);
            if (evaluation) {
                allRanks.push({
                    playerId: player.id,
                    rank: getHandName(evaluation),
                    score: evaluation.score,
                    bestHand: evaluation.bestHand
                });
            }
        }
    }

    // Resolve each pot
    for (let i = 0; i < state.pots.length; i++) {
        const pot = state.pots[i];
        const result = resolvePot(
            pot,
            i,
            newPlayers,
            state.communityCards,
            state.dealerSeat,
            state.config.maxSeats
        );

        // Distribute winnings to players
        for (const winner of result.winners) {
            const playerIndex = newPlayers.findIndex(p => p.id === winner.playerId);
            if (playerIndex !== -1) {
                newPlayers[playerIndex].stack += winner.amount;
            }

            // Add to winners list
            allWinners.push({
                playerId: winner.playerId,
                amount: winner.amount,
                handRank: winner.handRank
            });
        }
    }

    // Return new state with cleared pots and updated stacks
    return {
        ...state,
        players: newPlayers,
        pots: [], // Clear all pots
        rngState: { ...state.rngState },
        deck: [...state.deck],
        communityCards: [...state.communityCards],
        winners: allWinners
    };
};

/**
 * Gets the showdown result without modifying state.
 * Useful for UI display before applying changes.
 */
export const getShowdownResult = (state: GameState): ShowdownResult => {
    if (state.street !== 'showdown') {
        throw new Error('Cannot get showdown result: not at showdown street');
    }

    if (state.communityCards.length < 5) {
        throw new Error('Cannot get showdown result: need 5 community cards');
    }

    const winners: ShowdownResult['winners'] = [];
    const ranks: ShowdownResult['ranks'] = [];

    // Build ranks for all non-folded players
    for (const player of state.players) {
        if (player.status !== 'folded' && player.holeCards.length >= 2) {
            const evaluation = getPlayerEvaluation(player, state.communityCards);
            if (evaluation) {
                ranks.push({
                    playerId: player.id,
                    rank: getHandName(evaluation),
                    score: evaluation.score,
                    bestHand: evaluation.bestHand
                });
            }
        }
    }

    // Resolve each pot for winner info
    for (let i = 0; i < state.pots.length; i++) {
        const pot = state.pots[i];
        const result = resolvePot(
            pot,
            i,
            state.players,
            state.communityCards,
            state.dealerSeat,
            state.config.maxSeats
        );

        for (const winner of result.winners) {
            winners.push({
                playerId: winner.playerId,
                amount: winner.amount,
                handRank: winner.handRank
            });
        }
    }

    return { winners, ranks };
};

/**
 * Handles the case where only one player remains (all others folded).
 * Awards entire pot to the remaining player without showdown.
 */
export const resolveSingleWinner = (state: GameState): GameState => {
    const activePlayers = state.players.filter(p => p.status !== 'folded');

    if (activePlayers.length !== 1) {
        throw new Error('resolveSingleWinner requires exactly one active player');
    }

    const winner = activePlayers[0];
    const newPlayers = clonePlayers(state.players);

    // Award all pots to winner
    const totalWinnings = state.pots.reduce((sum, pot) => sum + pot.amount, 0);
    const winnerIndex = newPlayers.findIndex(p => p.id === winner.id);
    newPlayers[winnerIndex].stack += totalWinnings;

    return {
        ...state,
        players: newPlayers,
        pots: [],
        rngState: { ...state.rngState },
        deck: [...state.deck],
        communityCards: [...state.communityCards],
        winners: [{
            playerId: winner.id,
            amount: totalWinnings,
            handRank: 'Winner' // No hand rank needed for single winner
        }]
    };
};

// --- Exports ---

export const Showdown = {
    resolveShowdown,
    getShowdownResult,
    resolveSingleWinner
};
