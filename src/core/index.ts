// Re-export core modules with explicit exports to avoid conflicts
export type {
    Suit, Rank, Card, Street, PlayerStatus, Player, Pot, TableConfig,
    GameState, ActionType, Action, ShowdownResult, HandConfig, PRNGState
} from './types';

export { createPRNG, nextRandom, randomInt } from './prng';
export { createDeck, shuffleDeck, drawCards, parseCard, formatCard } from './deck';
export { createInitialState, getTotalChips, checkCardUniqueness } from './state';
export {
    getLegalActions,
    getLegalActionsDetailed,
    validateAction,
    resolveSidePots,
    isStreetComplete,
    getNextStreet,
    getActivePlayer,
    getNextActiveSeat,
    getFirstToActSeat,
    isBBOption,
    isSingleSurvivor,
    getPlayersInHand,
    Rules
} from './rules';
export { applyAction, runOutBoard, Engine } from './engine';
export { ConsistencyAudit } from './audit';
export { Evaluator, evaluate, getScore, getHandName } from './evaluator';
export type { HandEvaluation, HandRank } from './evaluator';
export { Showdown, resolveShowdown, getShowdownResult, resolveSingleWinner } from './showdown';
export {
    isValidChipAmount,
    isPositiveChipAmount,
    assertValidChipAmount,
    assertPositiveChipAmount,
    validateTableConfig,
    validatePlayerStack,
    validateActionAmount,
    sanitizeChipAmount,
} from './validation';
export type { ValidationError } from './validation';

// Range Manager exports
export {
    RANKS,
    TOTAL_COMBOS,
    getHandNotation,
    getHandCategory,
    countCombos,
    countWeightedCombos,
    generateHandMatrix,
    getAllHands,
    generateEmptyRange,
    generateFullRange,
    cloneRange,
    calculateRangeStats,
    generateTopPercentRange,
    mergeRanges,
    intersectRanges,
} from './ranges';
export type { Range, HandCategory, HandInfo, RangeStats, RankChar } from './ranges';

// Solver exports
export {
    DiscountedCFRTrainer,
    DEFAULT_DCFR_CONFIG,
    createInfosetKey,
} from './solver/DiscountedCFR';
export type { DiscountedCFRConfig } from './solver/DiscountedCFR';

export {
    BestResponse,
    calculateExploitability,
    formatExploitability,
} from './solver/BestResponse';
export type { ExploitabilityResult } from './solver/BestResponse';

export {
    DEFAULT_EXTENDED_CONFIG,
    DEFAULT_DCFR_PARAMS,
} from './solver/types';
export type {
    StreetPositionConfig,
    StreetConfig,
    ExtendedTreeConfig,
    GameTreeNodeType,
    GameRound,
    BaseGameNode,
    ActionGameNode,
    ChanceGameNode,
    ShowdownGameNode,
    TerminalGameNode,
    GameNode,
    DiscountedCFRParams,
    ExtendedCFRResult,
} from './solver/types';
