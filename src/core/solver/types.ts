import { Action, GameState, Card, ActionType } from '../types';

// ============================================================================
// TREE BUILDER TYPES (for game tree generation)
// ============================================================================

export type NodeType = 'action' | 'showdown' | 'terminal_fold';

/**
 * Original SolverNode for tree building.
 * Contains full GameState for debugging and visualization.
 */
export interface TreeBuilderNode {
    id: string; // Unique hash/ID
    state: GameState; // The engine state at this point
    type: NodeType;
    children: TreeBuilderEdge[];

    pot: number;
    activePlayer: number;
}

export interface TreeBuilderEdge {
    action: Action;
    nextNode: TreeBuilderNode;
}

export interface TreeConfig {
    betSizes: {
        preflop?: number[];
        flop: number[];
        turn: number[];
        river: number[];
    };
    maxRaises: number;
}

// Legacy alias for backwards compatibility
export type SolverNode = TreeBuilderNode;
export type SolverEdge = TreeBuilderEdge;

// ============================================================================
// CFR SOLVER TYPES (lightweight, optimized for solving)
// ============================================================================

/**
 * Lightweight action representation for CFR.
 * Only contains what's needed for the solver.
 */
export interface CFRAction {
    type: ActionType;
    amount: number; // 0 for fold/check, bet/raise amount otherwise
}

/**
 * Lightweight solver node optimized for CFR traversal.
 *
 * Key differences from TreeBuilderNode:
 * - Numeric ID for fast hashing
 * - No GameState storage (memory optimization)
 * - No regrets/strategy (stored in InfosetStore)
 * - Pre-calculated terminal payoffs
 */
export interface CFRNode {
    id: number;           // Unique numeric ID (position in tree)
    playerToAct: number;  // 0 or 1 (relative to HU match)
    actions: CFRAction[]; // Available actions at this node
    children: CFRNode[];  // Child nodes (same order as actions)

    isTerminal: boolean;
    payoff?: number;      // Only for terminal nodes, relative to Player 0
}

/**
 * Configuration for CFR solver.
 */
export interface CFRConfig {
    /** Bet sizes as fractions of pot per street */
    betSizes: {
        preflop?: number[];
        flop?: number[];
        turn?: number[];
        river: number[];
    };
    /** Maximum raises per street to limit tree size */
    maxRaises: number;
    /** Number of CFR iterations to run */
    iterations: number;
}

/**
 * Result of running CFR solver.
 */
export interface CFRResult {
    /** Exploitability measure (lower is better) */
    exploitability?: number;
    /** Number of iterations completed */
    iterations: number;
    /** Number of unique infosets */
    infosetCount: number;
    /** Expected value for Player 0 at root */
    rootEV: number;
    /** Time taken in milliseconds */
    timeMs: number;
}

/**
 * Spot configuration for HU river subgame.
 */
export interface RiverSpot {
    /** Pot size at start of river */
    pot: number;
    /** Player 0's stack (remaining chips) */
    stack0: number;
    /** Player 1's stack (remaining chips) */
    stack1: number;
    /** Community cards (5 cards for river) */
    board: Card[];
    /** Who acts first on river (0 = OOP, 1 = IP) */
    firstToAct: number;
}

/**
 * Hand assignment for a player in the solver.
 */
export interface HandAssignment {
    playerId: number; // 0 or 1
    cards: Card[];    // Hole cards (2 cards)
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Hand strength bucket for abstraction (future use).
 */
export type HandBucket = number;

/**
 * Range representation as array of [hand, weight] pairs.
 * Hand is encoded as a string like "AhKs".
 */
export type Range = Map<string, number>;

// ============================================================================
// EXTENDED TYPES FROM TEXASSOLVER
// ============================================================================

/**
 * Bet size configuration for a single position on a single street.
 * Based on TexasSolver's StreetSetting.
 */
export interface StreetPositionConfig {
    /** Bet sizes as fractions of pot (e.g., [0.33, 0.5, 0.75, 1.0]) */
    betSizes: number[];
    /** Raise sizes as fractions of pot */
    raiseSizes: number[];
    /** Donk bet sizes (OOP betting into aggressor from previous street) */
    donkSizes?: number[];
    /** Whether all-in is always available */
    allowAllIn: boolean;
}

/**
 * Configuration for both positions on a single street.
 */
export interface StreetConfig {
    /** In Position configuration */
    ip: StreetPositionConfig;
    /** Out of Position configuration */
    oop: StreetPositionConfig;
}

/**
 * Extended tree configuration with per-position bet sizes.
 * Based on TexasSolver's GameTreeBuildingSettings.
 */
export interface ExtendedTreeConfig {
    /** Configuration per street */
    streets: {
        preflop?: StreetConfig;
        flop: StreetConfig;
        turn: StreetConfig;
        river: StreetConfig;
    };
    /** Maximum raises allowed per street */
    maxRaisesPerStreet: number;
    /** All-in threshold (0.0-1.0) - auto all-in if bet would leave less than this fraction of stack */
    allInThreshold: number;
    /** Small blind amount */
    smallBlind: number;
    /** Big blind amount */
    bigBlind: number;
}

/**
 * Default extended config for common solving scenarios.
 */
export const DEFAULT_EXTENDED_CONFIG: ExtendedTreeConfig = {
    streets: {
        flop: {
            ip: { betSizes: [0.33, 0.67, 1.0], raiseSizes: [0.5, 1.0], allowAllIn: true },
            oop: { betSizes: [0.33, 0.67, 1.0], raiseSizes: [0.5, 1.0], donkSizes: [0.33, 0.5], allowAllIn: true }
        },
        turn: {
            ip: { betSizes: [0.5, 0.75, 1.0], raiseSizes: [0.5, 1.0], allowAllIn: true },
            oop: { betSizes: [0.5, 0.75, 1.0], raiseSizes: [0.5, 1.0], donkSizes: [0.5, 0.75], allowAllIn: true }
        },
        river: {
            ip: { betSizes: [0.5, 0.75, 1.0, 1.5], raiseSizes: [0.5, 1.0], allowAllIn: true },
            oop: { betSizes: [0.5, 0.75, 1.0, 1.5], raiseSizes: [0.5, 1.0], donkSizes: [0.5, 0.75], allowAllIn: true }
        }
    },
    maxRaisesPerStreet: 3,
    allInThreshold: 0.67,
    smallBlind: 0.5,
    bigBlind: 1
};

// ============================================================================
// NODE TYPES (matching TexasSolver architecture)
// ============================================================================

/**
 * Game tree node type enumeration.
 * Matches TexasSolver's GameTreeNode::GameTreeNodeType.
 */
export type GameTreeNodeType = 'ACTION' | 'CHANCE' | 'SHOWDOWN' | 'TERMINAL';

/**
 * Game round (street) enumeration.
 */
export type GameRound = 'preflop' | 'flop' | 'turn' | 'river';

/**
 * Base interface for all game tree nodes.
 */
export interface BaseGameNode {
    /** Unique node ID */
    id: number;
    /** Node type discriminator */
    type: GameTreeNodeType;
    /** Current pot size at this node */
    pot: number;
    /** Current game round */
    round: GameRound;
    /** Depth in tree (for debugging) */
    depth?: number;
}

/**
 * Action node - player makes a decision.
 * Equivalent to TexasSolver's ActionNode.
 */
export interface ActionGameNode extends BaseGameNode {
    type: 'ACTION';
    /** Which player acts (0 = OOP, 1 = IP) */
    player: 0 | 1;
    /** Available actions */
    actions: CFRAction[];
    /** Child nodes (same order as actions) */
    children: GameNode[];
}

/**
 * Chance node - community card is dealt.
 * Equivalent to TexasSolver's ChanceNode.
 */
export interface ChanceGameNode extends BaseGameNode {
    type: 'CHANCE';
    /** Possible cards that could be dealt (as indices 0-51) */
    possibleCards: number[];
    /** Single child subtree (cards tracked separately during traversal) */
    child: GameNode;
    /** Whether this is after a call by IP (enables donk betting) */
    isDonk?: boolean;
}

/**
 * Showdown node - both players show cards.
 * Equivalent to TexasSolver's ShowdownNode.
 * Payoffs are calculated at runtime based on hand strengths.
 */
export interface ShowdownGameNode extends BaseGameNode {
    type: 'SHOWDOWN';
    /** Tie payoffs for each player [p0, p1] */
    tiePayoffs: [number, number];
    /** Win payoffs: winPayoffs[winner][player] */
    winPayoffs: [[number, number], [number, number]];
}

/**
 * Terminal node - one player folded.
 * Equivalent to TexasSolver's TerminalNode.
 */
export interface TerminalGameNode extends BaseGameNode {
    type: 'TERMINAL';
    /** Which player won (the one who didn't fold) */
    winner: 0 | 1;
    /** Payoffs for each player [p0, p1] */
    payoffs: [number, number];
}

/**
 * Union type for all game node types.
 */
export type GameNode = ActionGameNode | ChanceGameNode | ShowdownGameNode | TerminalGameNode;

/**
 * Discounted CFR configuration parameters.
 * Based on TexasSolver's DiscountedCfrTrainable constants.
 */
export interface DiscountedCFRParams {
    /** Exponent for positive regret discounting */
    alpha: number;
    /** Multiplier for negative regrets */
    beta: number;
    /** Exponent for strategy accumulation */
    gamma: number;
    /** Decay factor for cumulative strategy */
    theta: number;
}

/**
 * Default DCFR parameters from TexasSolver.
 */
export const DEFAULT_DCFR_PARAMS: DiscountedCFRParams = {
    alpha: 1.5,
    beta: 0.5,
    gamma: 2.0,
    theta: 0.9
};

/**
 * Extended CFR result with exploitability.
 */
export interface ExtendedCFRResult extends CFRResult {
    /** Exploitability as percentage of pot */
    exploitabilityPct: number;
    /** Whether the solution has converged */
    converged: boolean;
    /** Per-iteration metrics (for graphing convergence) */
    history?: Array<{
        iteration: number;
        exploitabilityPct: number;
        timeMs: number;
    }>;
}
