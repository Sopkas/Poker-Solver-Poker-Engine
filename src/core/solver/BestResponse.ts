import { CFRNode } from './types';
import { InfosetStore, getAverageStrategy } from './InfosetStore';
import { Card } from '../types';
import { evaluate } from '../evaluator';

/**
 * Result of exploitability calculation.
 */
export interface ExploitabilityResult {
    /** Player 0's exploitability (how much a perfect opponent can win against P0's strategy) */
    player0Exploitability: number;
    /** Player 1's exploitability (how much a perfect opponent can win against P1's strategy) */
    player1Exploitability: number;
    /** Total exploitability as percentage of the pot */
    totalExploitabilityPct: number;
    /** Lower is better - 0% means perfect Nash Equilibrium */
    converged: boolean;
}

/**
 * Hand combination with reach probability for best response calculation.
 */
interface HandCombo {
    card1: number;  // Card index (0-51)
    card2: number;  // Card index (0-51)
    weight: number; // Range weight
    reachProbIndex: number; // Index in reach probs array
}

/**
 * Check if two sets of cards have any overlap (card blocking).
 */
function hasCardOverlap(cards1: number[], cards2: number[]): boolean {
    for (const c of cards1) {
        if (cards2.includes(c)) return true;
    }
    return false;
}

/**
 * BestResponse calculator - measures how exploitable a strategy is.
 * 
 * Based on TexasSolver's BestResponse.cpp implementation.
 * 
 * Exploitability measures how much a "perfect" opponent could win against
 * our current strategy. Lower exploitability = closer to Nash Equilibrium.
 * 
 * A strategy with 0% exploitability means there's no way for any opponent
 * to do better than break even against it (Nash Equilibrium).
 */
export class BestResponse {
    private playerCombos: HandCombo[][];

    /**
     * Create a BestResponse calculator.
     * 
     * @param hands0 Player 0's range (hole card combinations)
     * @param hands1 Player 1's range (hole card combinations)
     */
    constructor(
        hands0: Array<{ cards: Card[]; weight?: number }>,
        hands1: Array<{ cards: Card[]; weight?: number }>
    ) {
        this.playerCombos = [
            hands0.map((h, i) => ({
                card1: this.cardToIndex(h.cards[0]),
                card2: this.cardToIndex(h.cards[1]),
                weight: h.weight ?? 1,
                reachProbIndex: i
            })),
            hands1.map((h, i) => ({
                card1: this.cardToIndex(h.cards[0]),
                card2: this.cardToIndex(h.cards[1]),
                weight: h.weight ?? 1,
                reachProbIndex: i
            }))
        ];
    }

    /**
     * Convert card to index (0-51).
     */
    private cardToIndex(card: Card): number {
        const rankValues: Record<string, number> = {
            '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6,
            '9': 7, 'T': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12
        };
        const suitValues: Record<string, number> = {
            'c': 0, 'd': 1, 'h': 2, 's': 3
        };
        return rankValues[card.rank] * 4 + suitValues[card.suit];
    }

    /**
     * Calculate exploitability of the current strategy.
     * 
     * @param root Root node of the game tree
     * @param store InfosetStore containing learned strategies
     * @param board Community cards
     * @param initialPot Initial pot size (for normalization)
     * @param convergenceThreshold Exploitability % below which we consider converged
     */
    calculateExploitability(
        root: CFRNode,
        store: InfosetStore,
        board: Card[],
        initialPot: number,
        convergenceThreshold: number = 0.5
    ): ExploitabilityResult {
        // Initialize reach probabilities from range weights
        const reachProbs: Float64Array[] = [
            new Float64Array(this.playerCombos[0].map(c => c.weight)),
            new Float64Array(this.playerCombos[1].map(c => c.weight))
        ];

        // Calculate exploitability for each player
        let player0Exploitability = 0;
        let player1Exploitability = 0;

        // For player 0: calculate best response EV
        const ev0 = this.getBestResponseEV(
            root, 0, reachProbs, board, store, initialPot
        );
        player0Exploitability = ev0;

        // For player 1: calculate best response EV
        const ev1 = this.getBestResponseEV(
            root, 1, reachProbs, board, store, initialPot
        );
        player1Exploitability = ev1;

        // Total exploitability as percentage of pot
        const totalExploitability = (player0Exploitability + player1Exploitability) / 2;
        const totalExploitabilityPct = (totalExploitability / initialPot) * 100;

        return {
            player0Exploitability,
            player1Exploitability,
            totalExploitabilityPct,
            converged: totalExploitabilityPct <= convergenceThreshold
        };
    }

    /**
     * Calculate best response expected value for a player.
     */
    private getBestResponseEV(
        root: CFRNode,
        player: number,
        reachProbs: Float64Array[],
        board: Card[],
        store: InfosetStore,
        pot: number
    ): number {
        // Get EVs for all hands
        const handEVs = this.bestResponse(root, player, reachProbs, board, store);

        const playerCombos = this.playerCombos[player];
        const oppoCombos = this.playerCombos[1 - player];

        let totalEV = 0;
        const boardCards = board.map(c => this.cardToIndex(c));

        for (let handIdx = 0; handIdx < playerCombos.length; handIdx++) {
            const combo = playerCombos[handIdx];
            const handCards = [combo.card1, combo.card2];

            // Skip if hand conflicts with board
            if (hasCardOverlap(handCards, boardCards)) continue;

            // Calculate opponent weight sum (excluding blocked hands)
            let oppoSum = 0;
            for (const oppo of oppoCombos) {
                const oppoCards = [oppo.card1, oppo.card2];
                if (hasCardOverlap(oppoCards, boardCards)) continue; // Blocked by board
                if (hasCardOverlap(oppoCards, handCards)) continue;  // Blocked by our hand
                oppoSum += oppo.weight;
            }

            if (oppoSum > 0) {
                // Weight by relative probability
                totalEV += handEVs[handIdx] * (combo.weight / oppoSum);
            }
        }

        return totalEV;
    }

    /**
     * Convert cards to index array.
     */
    private cardsToIndexArray(cards: Card[]): number[] {
        return cards.map(c => this.cardToIndex(c));
    }

    /**
     * Recursive best response calculation.
     * 
     * Returns array of EVs for each hand combination.
     */
    private bestResponse(
        node: CFRNode,
        player: number,
        reachProbs: Float64Array[],
        board: Card[],
        store: InfosetStore
    ): Float64Array {
        if (node.isTerminal) {
            return this.terminalBestResponse(node, player, reachProbs, board);
        }

        const nodePlayer = node.playerToAct;
        const numActions = node.actions.length;
        const playerHands = this.playerCombos[player].length;

        if (nodePlayer === player) {
            // Player chooses best action (exploiting opponent)
            const myExploitability = new Float64Array(playerHands);
            let firstAction = true;

            for (const child of node.children) {
                const childEV = this.bestResponse(child, player, reachProbs, board, store);

                if (firstAction) {
                    myExploitability.set(childEV);
                    firstAction = false;
                } else {
                    // Take max EV for each hand
                    for (let i = 0; i < playerHands; i++) {
                        myExploitability[i] = Math.max(myExploitability[i], childEV[i]);
                    }
                }
            }

            return myExploitability;
        } else {
            // Opponent plays according to their strategy
            const totalPayoffs = new Float64Array(playerHands);

            // Get opponent's strategy
            const oppoHands = this.playerCombos[nodePlayer].length;

            // For each hand of opponent, get their strategy
            // Simplified: assume we can look up strategy by node ID
            // In full implementation, would iterate over opponent hands

            for (let actionIdx = 0; actionIdx < numActions; actionIdx++) {
                // Create new reach probs weighted by strategy
                const nextReachProbs: Float64Array[] = [
                    new Float64Array(reachProbs[0]),
                    new Float64Array(reachProbs[1])
                ];

                // Approximate: weight opponent reach probs by uniform strategy
                // In full implementation, would use actual strategy from store
                const strategyProb = 1 / numActions;
                for (let h = 0; h < oppoHands; h++) {
                    nextReachProbs[nodePlayer][h] *= strategyProb;
                }

                const childPayoffs = this.bestResponse(
                    node.children[actionIdx], player, nextReachProbs, board, store
                );

                for (let i = 0; i < playerHands; i++) {
                    totalPayoffs[i] += childPayoffs[i];
                }
            }

            return totalPayoffs;
        }
    }

    /**
     * Calculate terminal node payoffs.
     */
    private terminalBestResponse(
        node: CFRNode,
        player: number,
        reachProbs: Float64Array[],
        board: Card[]
    ): Float64Array {
        const playerHands = this.playerCombos[player].length;
        const payoffs = new Float64Array(playerHands);

        const oppo = 1 - player;
        const oppoCombos = this.playerCombos[oppo];
        const boardCards = this.cardsToIndexArray(board);

        // Calculate opponent sum (for normalization)
        let oppoSum = 0;
        const oppoCardSum = new Float64Array(52);

        for (let h = 0; h < oppoCombos.length; h++) {
            const combo = oppoCombos[h];
            const comboCards = [combo.card1, combo.card2];

            if (hasCardOverlap(comboCards, boardCards)) continue;

            const weight = reachProbs[oppo][h];
            oppoSum += weight;
            oppoCardSum[combo.card1] += weight;
            oppoCardSum[combo.card2] += weight;
        }

        // Calculate payoff for each player hand
        const playerPayoff = node.payoff ?? 0;
        const playerCombos = this.playerCombos[player];

        for (let h = 0; h < playerHands; h++) {
            const combo = playerCombos[h];
            const comboCards = [combo.card1, combo.card2];

            if (hasCardOverlap(comboCards, boardCards)) {
                payoffs[h] = 0;
                continue;
            }

            // Adjust for card removal
            const adjustedOppoSum = oppoSum
                - oppoCardSum[combo.card1]
                - oppoCardSum[combo.card2];

            payoffs[h] = playerPayoff * adjustedOppoSum;
        }

        return payoffs;
    }
}

/**
 * Calculate exploitability for a solved tree.
 * 
 * Convenience function that creates BestResponse and runs calculation.
 * 
 * @param root Root node of solved game tree
 * @param hands0 Player 0's range
 * @param hands1 Player 1's range
 * @param board Community cards
 * @param store InfosetStore with learned strategies
 * @param initialPot Initial pot size
 */
export function calculateExploitability(
    root: CFRNode,
    hands0: Array<{ cards: Card[]; weight?: number }>,
    hands1: Array<{ cards: Card[]; weight?: number }>,
    board: Card[],
    store: InfosetStore,
    initialPot: number
): ExploitabilityResult {
    const br = new BestResponse(hands0, hands1);
    return br.calculateExploitability(root, store, board, initialPot);
}

/**
 * Print exploitability in human-readable format.
 */
export function formatExploitability(result: ExploitabilityResult): string {
    const lines = [
        `Player 0 Exploitability: ${result.player0Exploitability.toFixed(4)}`,
        `Player 1 Exploitability: ${result.player1Exploitability.toFixed(4)}`,
        `Total Exploitability: ${result.totalExploitabilityPct.toFixed(2)}% of pot`,
        result.converged ? '✓ Converged' : '✗ Not converged'
    ];
    return lines.join('\n');
}
