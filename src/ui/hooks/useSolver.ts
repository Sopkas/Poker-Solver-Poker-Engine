import { useState, useCallback, useRef, useEffect } from 'react';
import { GameState, Card, Suit, Rank } from '../../core/types';
import { CFRAction } from '../../core/solver/types';
import { getRangeByType } from '../../utils/standardRanges';

// ============================================================================
// TYPES
// ============================================================================

export interface ActionStrategy {
    check?: number;
    bet?: number;
    fold?: number;
    call?: number;
    raise?: number;
}

export interface NodeInfo {
    nodeIdx: number;
    isTerminal: boolean;
    player: number;
    pot: number;
    infosetId?: number;
    numActions?: number;
    actions?: CFRAction[];
    message?: string;
}

export interface SolverSolution {
    /** Strategy for each hand in the range */
    strategies: Map<string, ActionStrategy>;
    /** Actions available at current node */
    availableActions: CFRAction[];
    /** Number of iterations completed */
    iterations: number;
    /** Number of unique infosets */
    infosetCount: number;
    /** Time taken in ms */
    timeMs: number;
    /** Player position (0=OOP, 1=IP) */
    heroPosition: number;
    /** Pot size */
    pot: number;
    /** Board cards */
    board: Card[];
    /** Exploitability as percentage of pot (Nash distance) */
    exploitabilityPct?: number;
    /** Whether solution has converged to Nash */
    converged?: boolean;
    /** Current node info (when navigated via history) */
    nodeInfo?: NodeInfo;
    /** Whether current node is terminal */
    isTerminal?: boolean;
    /** Current action history */
    currentHistory?: string[];
}

export interface SolverConfig {
    iterations: number;
    betSizes: number[];
    maxRaises: number;
    chunkSize: number; // Iterations per chunk to avoid UI freeze
}

export interface UseSolverReturn {
    isSolving: boolean;
    progress: number;
    solution: SolverSolution | null;
    error: string | null;
    runSolver: (gameState: GameState, heroSeat: number, config?: Partial<SolverConfig>) => void;
    cancelSolver: () => void;
    clearSolution: () => void;
    /** Fetch strategy for a specific action history (e.g., ["check", "bet 75"]) */
    getStrategyForHistory: (history: string[]) => void;
    /** Whether the worker is ready for history queries */
    isReady: boolean;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: SolverConfig = {
    iterations: 100000,
    betSizes: [0.33, 0.5, 0.75, 1.0],
    maxRaises: 2,
    chunkSize: 5000, // Can be larger with WASM
};

// ============================================================================
// HELPERS
// ============================================================================

const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS: Suit[] = ['s', 'h', 'd', 'c'];

/**
 * Generate all 169 hand classes
 */
function getAllHandClasses(): string[] {
    const hands: string[] = [];
    for (let i = 0; i < RANKS.length; i++) {
        for (let j = 0; j < RANKS.length; j++) {
            if (i === j) {
                hands.push(`${RANKS[i]}${RANKS[j]}`); // Pair
            } else if (i < j) {
                hands.push(`${RANKS[i]}${RANKS[j]}s`); // Suited
            } else {
                hands.push(`${RANKS[j]}${RANKS[i]}o`); // Offsuit
            }
        }
    }
    return hands;
}




/**
 * Expand hand classes (e.g., "AA", "AKs", "AKo") into specific card combinations
 * Format expected by Rust: "As Ah, As Kh, ..." (comma-separated, space between cards)
 */
function expandHandClassesToCombos(handClasses: string[], deadCards: Card[]): string {
    const deadSet = new Set(deadCards.map(c => `${c.rank}${c.suit}`));
    const combos: string[] = [];

    for (const hc of handClasses) {
        if (hc.length === 2) {
            // Pair: "AA" -> 6 combos
            const r = hc[0] as Rank;
            for (let i = 0; i < SUITS.length; i++) {
                for (let j = i + 1; j < SUITS.length; j++) {
                    const c1 = `${r}${SUITS[i]}`;
                    const c2 = `${r}${SUITS[j]}`;
                    if (!deadSet.has(c1) && !deadSet.has(c2)) {
                        combos.push(`${c1} ${c2}`);
                    }
                }
            }
        } else if (hc.length === 3 && hc[2] === 's') {
            // Suited: "AKs" -> 4 combos
            const r1 = hc[0] as Rank;
            const r2 = hc[1] as Rank;
            for (const suit of SUITS) {
                const c1 = `${r1}${suit}`;
                const c2 = `${r2}${suit}`;
                if (!deadSet.has(c1) && !deadSet.has(c2)) {
                    combos.push(`${c1} ${c2}`);
                }
            }
        } else if (hc.length === 3 && hc[2] === 'o') {
            // Offsuit: "AKo" -> 12 combos
            const r1 = hc[0] as Rank;
            const r2 = hc[1] as Rank;
            for (const s1 of SUITS) {
                for (const s2 of SUITS) {
                    if (s1 !== s2) {
                        const c1 = `${r1}${s1}`;
                        const c2 = `${r2}${s2}`;
                        if (!deadSet.has(c1) && !deadSet.has(c2)) {
                            combos.push(`${c1} ${c2}`);
                        }
                    }
                }
            }
        }
    }

    return combos.join(', ');
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useSolver(): UseSolverReturn {
    const [isSolving, setIsSolving] = useState(false);
    const [progress, setProgress] = useState(0);
    const [solution, setSolution] = useState<SolverSolution | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);

    const workerRef = useRef<Worker | null>(null);
    const startTimeRef = useRef<number>(0);
    const configRef = useRef<SolverConfig>(DEFAULT_CONFIG);
    const currentIterationRef = useRef(0);
    const solutionBaseRef = useRef<Omit<SolverSolution, 'strategies' | 'availableActions' | 'nodeInfo' | 'isTerminal' | 'currentHistory'> | null>(null);
    const currentHistoryRef = useRef<string[]>([]);

    // Cleanup worker on unmount
    useEffect(() => {
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
            }
        };
    }, []);

    const clearSolution = useCallback(() => {
        setSolution(null);
        setError(null);
        setProgress(0);
        setIsReady(false);
        currentHistoryRef.current = [];
        solutionBaseRef.current = null;
        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
        }
    }, []);

    const cancelSolver = useCallback(() => {
        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
        }
        setIsSolving(false);
        setProgress(0);
        setIsReady(false);
    }, []);

    /**
     * Fetch strategy for a specific action history.
     * The history should be an array of action strings, e.g., ["check", "bet 75"]
     */
    const getStrategyForHistory = useCallback((history: string[]) => {
        if (!workerRef.current || !isReady) {
            console.warn('[useSolver] Worker not ready for history query');
            return;
        }

        currentHistoryRef.current = history;
        console.log('[useSolver] Fetching strategy for history:', history);

        workerRef.current.postMessage({
            type: 'GET_STRATEGY',
            payload: {
                handClasses: getAllHandClasses(),
                history
            }
        });
    }, [isReady]);

    const runSolver = useCallback((
        gameState: GameState,
        heroSeat: number,
        configOverrides?: Partial<SolverConfig>
    ) => {
        // Validate: River only
        if (gameState.street !== 'river') {
            setError('Solver currently supports River only. Please advance to the river street.');
            return;
        }

        // Get active players
        const activePlayers = gameState.players.filter(p =>
            p.status === 'active' || p.status === 'all-in'
        );

        if (activePlayers.length !== 2) {
            setError('Solver requires exactly 2 active players (Heads-Up).');
            return;
        }

        // Validate board
        if (gameState.communityCards.length !== 5) {
            setError('River requires 5 community cards.');
            return;
        }

        const config = { ...DEFAULT_CONFIG, ...configOverrides };
        configRef.current = config;

        // Reset state
        cancelSolver(); // Terminate existing worker
        setError(null);
        setProgress(0);
        setIsSolving(true);
        setSolution(null);
        solutionBaseRef.current = null;
        currentHistoryRef.current = [];

        // Determine hero and villain
        const heroPlayer = activePlayers.find(p => p.seat === heroSeat);
        const villainPlayer = activePlayers.find(p => p.seat !== heroSeat);

        if (!heroPlayer || !villainPlayer) {
            setError('Could not identify hero and villain players.');
            setIsSolving(false);
            return;
        }

        // Determine positions (who acts first on river)
        const dealerSeat = gameState.dealerSeat;
        const heroIsIP = heroPlayer.seat === dealerSeat;
        const heroPosition = heroIsIP ? 1 : 0; // 0=OOP, 1=IP

        const pot = gameState.pots.reduce((sum, p) => sum + p.amount, 0);
        const boardCards = gameState.communityCards;
        const boardStr = boardCards.map(c => `${c.rank}${c.suit}`).join(' ');

        // Prepare ranges - expand hand classes into specific card combos
        // Dead cards include the board and hero's cards (if visible)
        const deadCards = [...boardCards];
        if (heroPlayer.holeCards) {
            deadCards.push(...heroPlayer.holeCards);
        }
        if (villainPlayer.holeCards) {
            deadCards.push(...villainPlayer.holeCards);
        }

        // Use asymmetric ranges for River scenarios
        // P0 (OOP) is capped, P1 (IP) is uncapped
        // getRangeByType returns a comma-separated string, so we split it into an array
        const oopRangeStr = getRangeByType('oop');
        const ipRangeStr = getRangeByType('ip');

        const oopHandClasses = oopRangeStr.split(',').map(s => s.trim());
        const ipHandClasses = ipRangeStr.split(',').map(s => s.trim());

        const range0 = expandHandClassesToCombos(oopHandClasses, deadCards);
        const range1 = expandHandClassesToCombos(ipHandClasses, deadCards);

        // Initialize Worker
        const worker = new Worker(new URL('../../workers/solver.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;
        startTimeRef.current = Date.now();
        currentIterationRef.current = 0;

        worker.onmessage = (e) => {
            const { type, payload } = e.data;

            if (type === 'ERROR') {
                setError(payload);
                setIsSolving(false);
                return;
            }

            if (type === 'INIT_SUCCESS') {
                // Start training
                worker.postMessage({
                    type: 'STEP',
                    payload: { iterations: config.chunkSize }
                });
            } else if (type === 'STEP_COMPLETE') {
                const stats = payload;
                currentIterationRef.current += config.chunkSize;
                const pct = Math.min(100, Math.round((currentIterationRef.current / config.iterations) * 100));
                setProgress(pct);

                if (currentIterationRef.current < config.iterations) {
                    // Next chunk
                    worker.postMessage({
                        type: 'STEP',
                        payload: { iterations: config.chunkSize }
                    });
                } else {
                    // Done, fetch strategy
                    worker.postMessage({
                        type: 'GET_STRATEGY',
                        payload: { handClasses: getAllHandClasses() }
                    });
                }
            } else if (type === 'STRATEGY_DATA') {
                const { stats, strategies, availableActions: actionsFromWasm, nodeInfo, isTerminal } = payload;

                // Debug logging
                console.log('[useSolver] STRATEGY_DATA received:', {
                    nodeInfo,
                    isTerminal,
                    availableActions: actionsFromWasm,
                    currentHistory: currentHistoryRef.current
                });
                const timeMs = Date.now() - startTimeRef.current;

                // Convert strategies object to Map
                const strategyMap = new Map<string, ActionStrategy>();
                for (const [k, v] of Object.entries(strategies)) {
                    strategyMap.set(k, v as ActionStrategy);
                }

                // Use actual actions from WASM with correct amounts
                // These come from the Rust tree where amount_from_parent is properly set
                const availableActions: CFRAction[] = actionsFromWasm && actionsFromWasm.length > 0
                    ? actionsFromWasm.map((a: { type: string; amount: number }) => ({
                        type: a.type as 'fold' | 'check' | 'call' | 'bet' | 'raise',
                        amount: a.amount
                    }))
                    : [
                        // Fallback if WASM doesn't provide actions
                        { type: 'check', amount: 0 },
                        { type: 'bet', amount: 0 },
                        { type: 'fold', amount: 0 },
                        { type: 'call', amount: 0 },
                        { type: 'raise', amount: 0 }
                    ];

                // Store base solution data for history queries
                if (!solutionBaseRef.current) {
                    solutionBaseRef.current = {
                        iterations: stats.iterations,
                        infosetCount: stats.infosets,
                        timeMs,
                        heroPosition,
                        pot,
                        board: boardCards,
                        exploitabilityPct: 0,
                        converged: true
                    };
                }

                setSolution({
                    ...solutionBaseRef.current,
                    strategies: strategyMap,
                    availableActions,
                    iterations: stats.iterations,
                    infosetCount: stats.infosets,
                    timeMs: solutionBaseRef.current.timeMs, // Keep original solve time
                    nodeInfo: nodeInfo as NodeInfo | undefined,
                    isTerminal: isTerminal || false,
                    currentHistory: currentHistoryRef.current
                });

                setIsSolving(false);
                setIsReady(true); // Worker is now ready for history queries
            }
        };

        // Send INIT
        // We need to construct the config JSON
        // CRITICAL: Use startHandStack (initial stack at street start), NOT current stack
        // Current stack changes as player makes actions on UI, but solver needs original stacks
        const initialStacks = [
            activePlayers[0].startHandStack ?? activePlayers[0].stack,
            activePlayers[1].startHandStack ?? activePlayers[1].stack
        ];

        // Initial pot is the pot BEFORE any actions on this street
        // player.bet contains current street bets (not yet collected into pot)
        // So pot.amount is already the "initial pot" for this street
        const initialPot = pot;

        console.log('[useSolver] Initializing solver with:', {
            initialPot,
            initialStacks,
            currentStacks: [activePlayers[0].stack, activePlayers[1].stack],
            betSizes: config.betSizes
        });

        const rustConfig = {
            initial_pot: initialPot,
            stacks: initialStacks,
            bet_sizes: config.betSizes,
            raise_sizes: [1.0], // Default raise size
            raise_limit: 3 // Max 3 raises per street (bet counts as first raise)
        };

        worker.postMessage({
            type: 'INIT',
            payload: {
                config: JSON.stringify(rustConfig),
                board: boardStr,
                range0: range0, // P0 Range (OOP)
                range1: range1  // P1 Range (IP)
            }
        });

    }, [cancelSolver]);

    return {
        isSolving,
        progress,
        solution,
        error,
        runSolver,
        cancelSolver,
        clearSolution,
        getStrategyForHistory,
        isReady,
    };
}
