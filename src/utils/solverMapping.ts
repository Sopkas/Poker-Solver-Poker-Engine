import { ActionStrategy, SolverSolution } from '../ui/hooks/useSolver';
import { RANKS, HandCell, generateRangeGrid } from './range';

// ============================================================================
// TYPES
// ============================================================================

export interface GridStrategy {
    hand: string;
    row: number;
    col: number;
    strategy: ActionStrategy;
    /** Primary action (highest probability) */
    primaryAction: keyof ActionStrategy;
    /** Primary action probability */
    primaryProb: number;
}

export interface StrategyGrid {
    /** 13x13 grid of strategies */
    grid: GridStrategy[][];
    /** Aggregated stats */
    stats: {
        avgBet: number;
        avgCheck: number;
        avgFold: number;
        avgCall: number;
        avgRaise: number;
    };
    /** Available actions from solver */
    availableActions: string[];
}

// ============================================================================
// MAPPING FUNCTIONS
// ============================================================================

/**
 * Map solver solution to 13x13 grid format for visualization.
 */
export function mapSolutionToGrid(solution: SolverSolution): StrategyGrid {
    const baseGrid = generateRangeGrid();
    const strategies = solution.strategies;

    // DEBUG: Log available actions from solver
    console.log('DEBUG: Available actions from solver:', solution.availableActions);
    console.log('DEBUG: Sample strategies:',
        Array.from(strategies.entries()).slice(0, 3).map(([hand, strat]) => ({ hand, strat }))
    );

    // Track aggregated stats
    let totalBet = 0, totalCheck = 0, totalFold = 0, totalCall = 0, totalRaise = 0;
    let count = 0;

    const grid: GridStrategy[][] = baseGrid.map((row, i) =>
        row.map((cell, j) => {
            const strategy = strategies.get(cell.hand) || getDefaultStrategy(solution);

            // Calculate primary action
            const entries = Object.entries(strategy) as [keyof ActionStrategy, number][];
            const sorted = entries.sort((a, b) => (b[1] || 0) - (a[1] || 0));
            const primaryAction = sorted[0]?.[0] || 'check';
            const primaryProb = sorted[0]?.[1] || 0;

            // Aggregate stats
            totalBet += strategy.bet || 0;
            totalCheck += strategy.check || 0;
            totalFold += strategy.fold || 0;
            totalCall += strategy.call || 0;
            totalRaise += strategy.raise || 0;
            count++;

            return {
                hand: cell.hand,
                row: i,
                col: j,
                strategy,
                primaryAction,
                primaryProb,
            };
        })
    );

    // Available actions
    const availableActions = solution.availableActions.map(a => {
        if (a.type === 'bet' || a.type === 'raise') {
            return `${a.type} ${a.amount}`;
        }
        return a.type;
    });

    return {
        grid,
        stats: {
            avgBet: count > 0 ? totalBet / count : 0,
            avgCheck: count > 0 ? totalCheck / count : 0,
            avgFold: count > 0 ? totalFold / count : 0,
            avgCall: count > 0 ? totalCall / count : 0,
            avgRaise: count > 0 ? totalRaise / count : 0,
        },
        availableActions,
    };
}

/**
 * Get default strategy when hand is not found in solution.
 */
function getDefaultStrategy(solution: SolverSolution): ActionStrategy {
    // Return uniform strategy based on available actions
    const numActions = solution.availableActions.length;
    const prob = numActions > 0 ? 1 / numActions : 0;

    const result: ActionStrategy = {};
    for (const action of solution.availableActions) {
        if (action.type === 'check') result.check = prob;
        else if (action.type === 'bet') result.bet = (result.bet || 0) + prob;
        else if (action.type === 'fold') result.fold = prob;
        else if (action.type === 'call') result.call = prob;
        else if (action.type === 'raise') result.raise = (result.raise || 0) + prob;
    }

    return result;
}

// ============================================================================
// COLOR HELPERS
// ============================================================================

export interface ActionColors {
    check: string;
    bet: string;
    fold: string;
    call: string;
    raise: string;
    allin: string;
}

export const DEFAULT_ACTION_COLORS: ActionColors = {
    check: '#22c55e',  // green-500
    bet: '#ef4444',    // red-500
    fold: '#6b7280',   // gray-500
    call: '#3b82f6',   // blue-500
    raise: '#b91c1c',  // dark red (updated from orange)
    allin: '#a855f7',  // purple-500
};

/**
 * Get the color for a specific action type.
 * This is the canonical color mapping for poker actions.
 */
export function getActionColor(action: keyof ActionStrategy | string): string {
    const normalizedAction = action.toLowerCase();
    switch (normalizedAction) {
        case 'fold': return DEFAULT_ACTION_COLORS.fold;
        case 'check': return DEFAULT_ACTION_COLORS.check;
        case 'call': return DEFAULT_ACTION_COLORS.call;
        case 'bet': return DEFAULT_ACTION_COLORS.bet;
        case 'raise': return DEFAULT_ACTION_COLORS.raise;
        case 'allin': return DEFAULT_ACTION_COLORS.allin;
        default: return DEFAULT_ACTION_COLORS.fold; // Grey fallback
    }
}

/**
 * Generate a CSS linear gradient for a strategy.
 * Each action gets a slice proportional to its probability.
 */
export function strategyToGradient(
    strategy: ActionStrategy,
    colors: ActionColors = DEFAULT_ACTION_COLORS
): string {
    const segments: { color: string; prob: number }[] = [];

    // Order: check, call, bet, raise, fold
    if (strategy.check) segments.push({ color: colors.check, prob: strategy.check });
    if (strategy.call) segments.push({ color: colors.call, prob: strategy.call });
    if (strategy.bet) segments.push({ color: colors.bet, prob: strategy.bet });
    if (strategy.raise) segments.push({ color: colors.raise, prob: strategy.raise });
    if (strategy.fold) segments.push({ color: colors.fold, prob: strategy.fold });

    if (segments.length === 0) {
        return colors.check; // Default to check color
    }

    if (segments.length === 1) {
        return segments[0].color;
    }

    // Build gradient stops
    let position = 0;
    const stops: string[] = [];

    for (const segment of segments) {
        const start = position;
        const end = position + segment.prob * 100;
        stops.push(`${segment.color} ${start.toFixed(1)}%`);
        stops.push(`${segment.color} ${end.toFixed(1)}%`);
        position = end;
    }

    return `linear-gradient(to right, ${stops.join(', ')})`;
}

/**
 * Generate a stacked gradient based on actual action types and their frequencies.
 * Order: Fold (bottom) -> Check -> Call -> Bet -> Raise (top)
 * This replaces the old two-color hardcoded gradient.
 */
export function strategyToActionGradient(strategy: ActionStrategy): string {
    // Define action order for consistent stacking (bottom to top)
    const actionOrder: (keyof ActionStrategy)[] = ['fold', 'check', 'call', 'bet', 'raise'];

    const segments: { action: keyof ActionStrategy; color: string; prob: number }[] = [];

    for (const action of actionOrder) {
        const prob = strategy[action];
        if (prob && prob > 0.001) { // Only include actions with meaningful probability
            segments.push({
                action,
                color: getActionColor(action),
                prob,
            });
        }
    }

    if (segments.length === 0) {
        return DEFAULT_ACTION_COLORS.fold; // Grey fallback
    }

    if (segments.length === 1) {
        return segments[0].color;
    }

    // Build gradient stops (bottom to top)
    let position = 0;
    const stops: string[] = [];

    for (const segment of segments) {
        const start = position;
        const end = position + segment.prob * 100;
        stops.push(`${segment.color} ${start.toFixed(1)}%`);
        stops.push(`${segment.color} ${end.toFixed(1)}%`);
        position = end;
    }

    return `linear-gradient(to top, ${stops.join(', ')})`;
}

/**
 * @deprecated Use strategyToActionGradient instead.
 * Generate a simpler two-color gradient for primary action visualization.
 * Shows bet/raise vs check/call/fold.
 */
export function strategyToSimpleGradient(strategy: ActionStrategy): string {
    // Redirect to new action-aware gradient
    return strategyToActionGradient(strategy);
}

/**
 * Get background color based on primary action.
 */
export function getPrimaryActionColor(action: keyof ActionStrategy): string {
    return DEFAULT_ACTION_COLORS[action] || DEFAULT_ACTION_COLORS.check;
}

/**
 * Format strategy as human-readable string.
 */
export function formatStrategy(strategy: ActionStrategy): string {
    const parts: string[] = [];

    if (strategy.check && strategy.check > 0.01) {
        parts.push(`Check ${(strategy.check * 100).toFixed(0)}%`);
    }
    if (strategy.call && strategy.call > 0.01) {
        parts.push(`Call ${(strategy.call * 100).toFixed(0)}%`);
    }
    if (strategy.bet && strategy.bet > 0.01) {
        parts.push(`Bet ${(strategy.bet * 100).toFixed(0)}%`);
    }
    if (strategy.raise && strategy.raise > 0.01) {
        parts.push(`Raise ${(strategy.raise * 100).toFixed(0)}%`);
    }
    if (strategy.fold && strategy.fold > 0.01) {
        parts.push(`Fold ${(strategy.fold * 100).toFixed(0)}%`);
    }

    return parts.join(' | ') || 'Unknown';
}

/**
 * Calculate how "aggressive" a strategy is (0-1 scale).
 * Higher = more betting/raising.
 */
export function getAggressiveness(strategy: ActionStrategy): number {
    return (strategy.bet || 0) + (strategy.raise || 0);
}

/**
 * Get a single opacity value based on how strong/active the strategy is.
 * Used for simple highlighting.
 */
export function getStrategyIntensity(strategy: ActionStrategy): number {
    // Max action probability indicates how "decided" the strategy is
    const probs = [
        strategy.check || 0,
        strategy.bet || 0,
        strategy.fold || 0,
        strategy.call || 0,
        strategy.raise || 0,
    ];
    return Math.max(...probs);
}
