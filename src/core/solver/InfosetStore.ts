import { Card } from '../types';

/**
 * InfosetStore - High-performance storage for CFR learning data.
 *
 * Uses Float64Array for cache-friendly memory layout.
 * Each infoset stores: [regret_0, regret_1, ..., regret_N, strategy_0, strategy_1, ..., strategy_N]
 *
 * Key insight: Tree structure is decoupled from learning data.
 * The same infoset (same cards + same betting history) maps to the same key.
 */
export class InfosetStore {
    private store = new Map<string, Float64Array>();

    // Stats for debugging
    private _hits = 0;
    private _misses = 0;

    /**
     * Get or create the data array for an infoset.
     * @param key Canonical infoset key
     * @param numActions Number of available actions at this node
     * @returns Float64Array of size numActions * 2 (regrets + strategy sums)
     */
    get(key: string, numActions: number): Float64Array {
        let data = this.store.get(key);

        if (data) {
            this._hits++;
            // Validate size matches (shouldn't happen in correct usage)
            if (data.length !== numActions * 2) {
                throw new Error(`InfosetStore size mismatch: expected ${numActions * 2}, got ${data.length}`);
            }
            return data;
        }

        this._misses++;
        // Initialize with zeros
        data = new Float64Array(numActions * 2);
        this.store.set(key, data);
        return data;
    }

    /**
     * Generate a canonical infoset key.
     *
     * Combines:
     * - nodeId: Encodes the betting history (position in tree)
     * - cards: Player's hole cards (canonicalized)
     * - board: Community cards (canonicalized)
     *
     * Canonicalization ensures AhKs == KsAh (order-independent).
     */
    generateKey(nodeId: number, cards: Card[], board: Card[]): string {
        const canonicalCards = this.canonicalizeCards(cards);
        const canonicalBoard = this.canonicalizeCards(board);

        return `${nodeId}|${canonicalCards}|${canonicalBoard}`;
    }

    /**
     * Canonicalize cards to a deterministic string representation.
     * Cards are sorted by rank (descending), then suit (alphabetical).
     *
     * Example: [Ks, Ah] -> "AhKs"
     */
    private canonicalizeCards(cards: Card[]): string {
        if (cards.length === 0) return '';

        const rankOrder: Record<string, number> = {
            'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10,
            '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
        };

        const suitOrder: Record<string, number> = {
            'c': 0, 'd': 1, 'h': 2, 's': 3
        };

        // Sort: higher rank first, then by suit alphabetically
        const sorted = [...cards].sort((a, b) => {
            const rankDiff = rankOrder[b.rank] - rankOrder[a.rank];
            if (rankDiff !== 0) return rankDiff;
            return suitOrder[a.suit] - suitOrder[b.suit];
        });

        return sorted.map(c => `${c.rank}${c.suit}`).join('');
    }

    /**
     * Get the number of unique infosets stored.
     */
    get size(): number {
        return this.store.size;
    }

    /**
     * Get cache statistics.
     */
    get stats(): { hits: number; misses: number; size: number } {
        return {
            hits: this._hits,
            misses: this._misses,
            size: this.store.size
        };
    }

    /**
     * Clear all stored data (for testing or new solve).
     */
    clear(): void {
        this.store.clear();
        this._hits = 0;
        this._misses = 0;
    }

    /**
     * Extract regret sum values from data array.
     * @param data The Float64Array from get()
     * @param numActions Number of actions
     * @returns View into regret portion (indices 0..numActions-1)
     */
    static getRegrets(data: Float64Array, numActions: number): Float64Array {
        return data.subarray(0, numActions);
    }

    /**
     * Extract strategy sum values from data array.
     * @param data The Float64Array from get()
     * @param numActions Number of actions
     * @returns View into strategy portion (indices numActions..2*numActions-1)
     */
    static getStrategySums(data: Float64Array, numActions: number): Float64Array {
        return data.subarray(numActions, numActions * 2);
    }
}

/**
 * Regret Matching: Convert regret sums to current strategy.
 *
 * Strategy[a] = max(0, Regret[a]) / sum(max(0, Regrets))
 * If all regrets are non-positive, use uniform strategy.
 *
 * @param regrets Regret sum values
 * @param strategy Output array for strategy (will be modified in-place)
 */
export function regretMatch(regrets: Float64Array, strategy: Float64Array): void {
    const numActions = regrets.length;
    let sum = 0;

    // Calculate sum of positive regrets
    for (let i = 0; i < numActions; i++) {
        if (regrets[i] > 0) {
            sum += regrets[i];
        }
    }

    // Normalize or use uniform
    if (sum > 0) {
        for (let i = 0; i < numActions; i++) {
            strategy[i] = regrets[i] > 0 ? regrets[i] / sum : 0;
        }
    } else {
        // Uniform strategy when all regrets are non-positive
        const uniform = 1 / numActions;
        for (let i = 0; i < numActions; i++) {
            strategy[i] = uniform;
        }
    }
}

/**
 * Calculate average strategy from accumulated strategy sums.
 *
 * @param strategySums Accumulated strategy sum values
 * @param output Output array for average strategy
 */
export function getAverageStrategy(strategySums: Float64Array, output: Float64Array): void {
    const numActions = strategySums.length;
    let sum = 0;

    for (let i = 0; i < numActions; i++) {
        sum += strategySums[i];
    }

    if (sum > 0) {
        for (let i = 0; i < numActions; i++) {
            output[i] = strategySums[i] / sum;
        }
    } else {
        // Uniform if no samples
        const uniform = 1 / numActions;
        for (let i = 0; i < numActions; i++) {
            output[i] = uniform;
        }
    }
}
