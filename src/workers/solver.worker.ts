/* eslint-disable no-restricted-globals */
import init, { SolverSession } from '../../public/wasm/poker_solver_core';

// Worker state
let session: SolverSession | null = null;
let isInitialized = false;

// Initialize WASM
const initWasm = async () => {
    if (!isInitialized) {
        // In Web Workers, relative URLs don't work the same way.
        // We need to construct an absolute URL using the origin.
        const wasmUrl = new URL('/wasm/poker_solver_core_bg.wasm', self.location.origin).href;
        await init(wasmUrl);
        isInitialized = true;
        console.log('Solver Worker: WASM Initialized');
    }
};

/**
 * Convert a hand class (e.g., "AA", "AKs", "AKo") to all possible hand strings
 * Returns array of hand strings to try
 */
function handClassToHandStrs(handClass: string): string[] {
    const suits = ['s', 'h', 'd', 'c'];
    const results: string[] = [];

    if (handClass.length === 2) { // Pair "AA"
        const r = handClass[0];
        // All 6 combinations of pairs
        for (let i = 0; i < suits.length; i++) {
            for (let j = i + 1; j < suits.length; j++) {
                results.push(`${r}${suits[i]} ${r}${suits[j]}`);
            }
        }
    } else if (handClass.endsWith('s')) { // Suited "AKs"
        const r1 = handClass[0];
        const r2 = handClass[1];
        // All 4 suited combinations
        for (const suit of suits) {
            results.push(`${r1}${suit} ${r2}${suit}`);
        }
    } else { // Offsuit "AKo"
        const r1 = handClass[0];
        const r2 = handClass[1];
        // All 12 offsuit combinations
        for (const s1 of suits) {
            for (const s2 of suits) {
                if (s1 !== s2) {
                    results.push(`${r1}${s1} ${r2}${s2}`);
                }
            }
        }
    }

    return results;
}

/**
 * Convert a hand class (e.g., "AA", "AKs", "AKo") to a representative hand string
 * @deprecated Use handClassToHandStrs for better matching
 */
function handClassToHandStr(handClass: string): string {
    return handClassToHandStrs(handClass)[0];
}

/**
 * Parse strategy from WASM response into ActionStrategy format
 * Normalizes probabilities to sum to 1.0
 */
function parseStrategyToActionMap(strat: { actions: any[]; probs: number[] }): Record<string, number> {
    const actionStrategy: Record<string, number> = {};

    strat.actions.forEach((action: any, idx: number) => {
        const prob = strat.probs[idx];
        if (prob > 0.001) {
            // Handle both string format ("check", "bet 75") and object format ({ type: "bet", amount: 75 })
            const actionStr = typeof action === 'string' ? action : action.type;

            if (actionStr.includes('check')) actionStrategy.check = (actionStrategy.check || 0) + prob;
            else if (actionStr.includes('fold')) actionStrategy.fold = (actionStrategy.fold || 0) + prob;
            else if (actionStr.includes('call')) actionStrategy.call = (actionStrategy.call || 0) + prob;
            else if (actionStr.includes('bet')) actionStrategy.bet = (actionStrategy.bet || 0) + prob;
            else if (actionStr.includes('raise')) actionStrategy.raise = (actionStrategy.raise || 0) + prob;
        }
    });

    // Normalize to ensure sum = 1.0
    const sum = Object.values(actionStrategy).reduce((a, b) => a + b, 0);
    if (sum > 0 && Math.abs(sum - 1.0) > 0.001) {
        for (const key of Object.keys(actionStrategy)) {
            actionStrategy[key] /= sum;
        }
    }

    return actionStrategy;
}

// Message handler
self.onmessage = async (e: MessageEvent) => {
    const { type, payload } = e.data;

    try {
        switch (type) {
            case 'INIT':
                await initWasm();
                const { config, board, range0, range1 } = payload;

                // Create new session
                try {
                    session = new SolverSession(config, board, range0, range1);
                    self.postMessage({ type: 'INIT_SUCCESS', payload: JSON.parse(session.get_stats()) });
                } catch (err) {
                    self.postMessage({ type: 'ERROR', payload: `Failed to create session: ${err}` });
                }
                break;

            case 'STEP':
                if (!session) {
                    self.postMessage({ type: 'ERROR', payload: 'Session not initialized' });
                    return;
                }

                const { iterations } = payload;
                session.step(iterations);

                // Send progress update
                self.postMessage({ type: 'STEP_COMPLETE', payload: JSON.parse(session.get_stats()) });
                break;

            case 'GET_STRATEGY':
                if (!session) {
                    self.postMessage({ type: 'ERROR', payload: 'Session not initialized' });
                    return;
                }

                const { handClasses, history } = payload;
                console.log('[Worker] GET_STRATEGY received. History:', history, 'Length:', history?.length || 0);
                const strategies: Record<string, any> = {};
                let nodeIdx: number | null = null;
                let nodeInfo: any = null;
                let availableActions: { type: string; amount: number }[] = [];

                // If history is provided, navigate to that node first
                if (history && Array.isArray(history) && history.length > 0) {
                    try {
                        console.log('[Worker] Getting strategy for history:', history);
                        const nodeInfoJson = session.get_strategy_for_history(history);
                        nodeInfo = JSON.parse(nodeInfoJson);
                        nodeIdx = nodeInfo.nodeIdx;

                        console.log('[Worker] Node info:', nodeInfo);

                        // Check if we reached a terminal node
                        if (nodeInfo.isTerminal) {
                            self.postMessage({
                                type: 'STRATEGY_DATA',
                                payload: {
                                    stats: JSON.parse(session.get_stats()),
                                    strategies: {},
                                    availableActions: [],
                                    nodeInfo,
                                    isTerminal: true
                                }
                            });
                            return;
                        }

                        // Get actions at this node
                        availableActions = nodeInfo.actions || [];

                        // Get strategy for each hand class at this node
                        if (handClasses && Array.isArray(handClasses) && nodeIdx !== null) {
                            for (const handClass of handClasses) {
                                // Try all possible combos for this hand class
                                const handStrs = handClassToHandStrs(handClass);
                                let found = false;

                                for (const handStr of handStrs) {
                                    try {
                                        const stratJson = session.get_hand_strategy_at_node(handStr, nodeIdx);
                                        const strat = JSON.parse(stratJson);
                                        strategies[handClass] = parseStrategyToActionMap(strat);
                                        found = true;
                                        break; // Use first valid combo
                                    } catch (e) {
                                        // This combo not in range, try next
                                    }
                                }

                                if (!found) {
                                    // Hand class not in range at this node
                                }
                            }
                        }
                    } catch (e) {
                        console.error('[Worker] Failed to get strategy for history:', e);
                        // Return error to user instead of silent fallback
                        self.postMessage({
                            type: 'ERROR',
                            payload: `Navigation failed: ${e}. Check that action history matches tree nodes.`
                        });
                        return;
                    }
                }

                // If no history or history navigation failed, use root node
                if (nodeIdx === null) {
                    // Get available actions at root
                    try {
                        const actionsJson = session.get_node_actions();
                        availableActions = JSON.parse(actionsJson);
                    } catch (e) {
                        console.warn('Failed to get node actions:', e);
                    }

                    // Get strategy for each hand class at root
                    if (handClasses && Array.isArray(handClasses)) {
                        for (const handClass of handClasses) {
                            // Try all possible combos for this hand class
                            const handStrs = handClassToHandStrs(handClass);

                            for (const handStr of handStrs) {
                                try {
                                    const stratJson = session.get_hand_strategy(handStr);
                                    const strat = JSON.parse(stratJson);
                                    strategies[handClass] = parseStrategyToActionMap(strat);
                                    break; // Use first valid combo
                                } catch (e) {
                                    // This combo not in range, try next
                                }
                            }
                        }
                    }
                }

                self.postMessage({
                    type: 'STRATEGY_DATA',
                    payload: {
                        stats: JSON.parse(session.get_stats()),
                        strategies,
                        availableActions,
                        nodeInfo,
                        isTerminal: false
                    }
                });
                break;

            default:
                console.warn('Unknown message type:', type);
        }
    } catch (err) {
        console.error('Worker Error:', err);
        self.postMessage({ type: 'ERROR', payload: String(err) });
    }
};

export { };
