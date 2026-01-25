import { Card } from '../types';

/**
 * Configuration for Discounted CFR algorithm.
 * 
 * Based on TexasSolver's DiscountedCfrTrainable implementation.
 * These parameters control the regret discounting and strategy accumulation.
 */
export interface DiscountedCFRConfig {
    /** Exponent for positive regret discounting (default: 1.5) */
    alpha: number;
    /** Multiplier for negative regrets (default: 0.5) */
    beta: number;
    /** Exponent for strategy accumulation (default: 2.0) */
    gamma: number;
    /** Decay factor for cumulative strategy (default: 0.9) */
    theta: number;
}

/**
 * Default configuration matching TexasSolver's proven parameters.
 */
export const DEFAULT_DCFR_CONFIG: DiscountedCFRConfig = {
    alpha: 1.5,
    beta: 0.5,
    gamma: 2.0,
    theta: 0.9
};

/**
 * DiscountedCFRTrainer - Manages discounted CFR regret and strategy accumulation.
 * 
 * Key differences from Vanilla CFR:
 * - Positive regrets are multiplied by t^α / (1 + t^α) where t is iteration
 * - Negative regrets are multiplied by β (typically 0.5)
 * - Strategy accumulation uses γ and θ for faster convergence
 * 
 * This leads to 2-10x faster convergence compared to Vanilla CFR.
 * 
 * Memory layout (flat arrays for cache efficiency):
 * - rPlus[action * numHands + hand] - Accumulated positive regrets
 * - cumRPlus[action * numHands + hand] - Cumulative strategy for averaging
 * - rPlusSum[hand] - Sum of positive regrets per hand (for normalization)
 */
export class DiscountedCFRTrainer {
    /** Accumulated regrets (R+) */
    private rPlus: Float64Array;

    /** Sum of positive regrets per hand (for strategy normalization) */
    private rPlusSum: Float64Array;

    /** Cumulative strategy sums (for average strategy) */
    private cumRPlus: Float64Array;

    /** Expected values per action per hand (for analysis) */
    private evs: Float64Array;

    /** Configuration parameters */
    private config: DiscountedCFRConfig;

    /** Number of available actions at this node */
    readonly numActions: number;

    /** Number of possible hands for the player */
    readonly numHands: number;

    constructor(
        numActions: number,
        numHands: number,
        config: Partial<DiscountedCFRConfig> = {}
    ) {
        this.numActions = numActions;
        this.numHands = numHands;
        this.config = { ...DEFAULT_DCFR_CONFIG, ...config };

        const totalSize = numActions * numHands;
        this.rPlus = new Float64Array(totalSize);
        this.cumRPlus = new Float64Array(totalSize);
        this.evs = new Float64Array(totalSize);
        this.rPlusSum = new Float64Array(numHands);
    }

    /**
     * Update regrets using Discounted CFR formula.
     * 
     * @param regrets New regrets to add [action * numHands + hand]
     * @param iteration Current iteration number (1-indexed)
     * @param reachProbs Optional reach probabilities for the player
     */
    updateRegrets(
        regrets: Float64Array,
        iteration: number,
        reachProbs?: Float64Array
    ): void {
        const { alpha, beta } = this.config;

        // Calculate alpha coefficient: t^α / (1 + t^α)
        const tPowAlpha = Math.pow(iteration, alpha);
        const alphaCoef = tPowAlpha / (1 + tPowAlpha);

        // Reset sum array
        this.rPlusSum.fill(0);

        // Update regrets with discounting
        for (let actionId = 0; actionId < this.numActions; actionId++) {
            for (let handId = 0; handId < this.numHands; handId++) {
                const idx = actionId * this.numHands + handId;

                // Add new regret
                this.rPlus[idx] += regrets[idx];

                // Apply discounting
                if (this.rPlus[idx] > 0) {
                    // Positive regrets: multiply by alphaCoef
                    this.rPlus[idx] *= alphaCoef;
                } else {
                    // Negative regrets: multiply by beta
                    this.rPlus[idx] *= beta;
                }

                // Accumulate positive regrets for normalization
                this.rPlusSum[handId] += Math.max(0, this.rPlus[idx]);
            }
        }

        // Update cumulative strategy
        this.updateCumulativeStrategy(iteration, reachProbs);
    }

    /**
     * Update cumulative strategy sums for average strategy calculation.
     */
    private updateCumulativeStrategy(iteration: number, reachProbs?: Float64Array): void {
        const { gamma, theta } = this.config;

        // Strategy coefficient: (t / (t+1))^γ
        const strategyCoef = Math.pow(iteration / (iteration + 1), gamma);

        // Get current strategy for accumulation
        const currentStrategy = this.getCurrentStrategyInternal();

        for (let actionId = 0; actionId < this.numActions; actionId++) {
            for (let handId = 0; handId < this.numHands; handId++) {
                const idx = actionId * this.numHands + handId;

                // Decay old strategy
                this.cumRPlus[idx] *= theta;

                // Add current strategy weighted by strategyCoef
                this.cumRPlus[idx] += currentStrategy[idx] * strategyCoef;
            }
        }
    }

    /**
     * Get the current strategy based on regret matching.
     * 
     * @returns Float64Array of size [numActions * numHands]
     */
    getCurrentStrategy(): Float64Array {
        return this.getCurrentStrategyInternal();
    }

    /**
     * Internal method to compute current strategy.
     */
    private getCurrentStrategyInternal(): Float64Array {
        const strategy = new Float64Array(this.numActions * this.numHands);

        for (let handId = 0; handId < this.numHands; handId++) {
            for (let actionId = 0; actionId < this.numActions; actionId++) {
                const idx = actionId * this.numHands + handId;

                if (this.rPlusSum[handId] > 0) {
                    // Normalize by sum of positive regrets
                    strategy[idx] = Math.max(0, this.rPlus[idx]) / this.rPlusSum[handId];
                } else {
                    // Uniform strategy when all regrets are non-positive
                    strategy[idx] = 1 / this.numActions;
                }
            }
        }

        return strategy;
    }

    /**
     * Get the average strategy (what we actually "play" after training).
     * 
     * This is the converged Nash Equilibrium approximation.
     * 
     * @returns Float64Array of size [numActions * numHands]
     */
    getAverageStrategy(): Float64Array {
        const avgStrategy = new Float64Array(this.numActions * this.numHands);

        for (let handId = 0; handId < this.numHands; handId++) {
            // Calculate sum for this hand
            let sum = 0;
            for (let actionId = 0; actionId < this.numActions; actionId++) {
                const idx = actionId * this.numHands + handId;
                sum += this.cumRPlus[idx];
            }

            // Normalize
            for (let actionId = 0; actionId < this.numActions; actionId++) {
                const idx = actionId * this.numHands + handId;
                if (sum > 0) {
                    avgStrategy[idx] = this.cumRPlus[idx] / sum;
                } else {
                    avgStrategy[idx] = 1 / this.numActions;
                }
            }
        }

        return avgStrategy;
    }

    /**
     * Set expected values for this node (for analysis/debugging).
     * 
     * @param evs Expected values [action * numHands + hand]
     */
    setEVs(evs: Float64Array): void {
        if (evs.length !== this.evs.length) {
            throw new Error(`EV size mismatch: expected ${this.evs.length}, got ${evs.length}`);
        }

        for (let i = 0; i < evs.length; i++) {
            // Only update if not NaN
            if (!Number.isNaN(evs[i])) {
                this.evs[i] = evs[i];
            }
        }
    }

    /**
     * Get expected values.
     */
    getEVs(): Float64Array {
        return new Float64Array(this.evs);
    }

    /**
     * Copy strategy from another trainer (for isomorphism optimization).
     */
    copyFrom(other: DiscountedCFRTrainer): void {
        if (other.numActions !== this.numActions || other.numHands !== this.numHands) {
            throw new Error('Cannot copy from trainer with different dimensions');
        }

        this.rPlus.set(other.rPlus);
        this.cumRPlus.set(other.cumRPlus);
        this.rPlusSum.set(other.rPlusSum);
    }

    /**
     * Check if all regrets are zero (for testing).
     */
    isAllZeros(): boolean {
        for (let i = 0; i < this.rPlus.length; i++) {
            if (this.rPlus[i] !== 0) return false;
        }
        return true;
    }

    /**
     * Get strategy for a specific hand as a regular array.
     * Useful for UI display.
     * 
     * @param handIndex Index of the hand
     * @returns Array of action probabilities
     */
    getStrategyForHand(handIndex: number): number[] {
        const avgStrategy = this.getAverageStrategy();
        const result: number[] = [];

        for (let actionId = 0; actionId < this.numActions; actionId++) {
            result.push(avgStrategy[actionId * this.numHands + handIndex]);
        }

        return result;
    }
}

/**
 * Create a simple infoset key combining node ID and cards.
 */
export function createInfosetKey(
    nodeId: number,
    cards: Card[],
    board: Card[]
): string {
    const cardStr = cards
        .map(c => `${c.rank}${c.suit}`)
        .sort()
        .join('');

    const boardStr = board
        .map(c => `${c.rank}${c.suit}`)
        .sort()
        .join('');

    return `${nodeId}|${cardStr}|${boardStr}`;
}
