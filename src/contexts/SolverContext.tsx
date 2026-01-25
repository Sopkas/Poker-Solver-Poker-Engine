'use client';

import React, { createContext, useContext, useCallback, useRef } from 'react';
import { useSolver, UseSolverReturn, SolverConfig } from '../ui/hooks/useSolver';
import { GameState, ActionType } from '../core/types';

// ============================================================================
// TYPES
// ============================================================================

interface SolverContextValue extends UseSolverReturn {
    /** Current action history for solver navigation */
    actionHistory: string[];
    /** Add action to history and fetch new strategy */
    addAction: (actionType: ActionType, amount?: number) => void;
    /** Reset action history (e.g., when starting new solve) */
    resetHistory: () => void;
    /** Set action history directly (for manual navigation in solver panel) */
    setActionHistory: (history: string[]) => void;
    /** Start solver with initial state (stores snapshot) */
    initializeSolver: (state: GameState, heroSeat: number, config?: Partial<SolverConfig>) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const SolverContext = createContext<SolverContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export const SolverProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const solver = useSolver();
    const [actionHistory, setActionHistory] = React.useState<string[]>([]);
    const initialStateRef = useRef<GameState | null>(null);

    /**
     * Convert ActionType + amount to solver history string format
     * e.g., 'check' -> 'check', 'bet' + 75 -> 'bet 75'
     */
    const actionToString = useCallback((actionType: ActionType, amount?: number): string => {
        switch (actionType) {
            case 'fold':
                return 'fold';
            case 'check':
                return 'check';
            case 'call':
                return 'call';
            case 'bet':
                return amount ? `bet ${amount}` : 'bet';
            case 'raise':
                return amount ? `raise ${amount}` : 'raise';
            default:
                return actionType;
        }
    }, []);

    /**
     * Add action to history and fetch strategy for new position
     */
    const addAction = useCallback((actionType: ActionType, amount?: number) => {
        if (!solver.isReady) {
            console.warn('[SolverContext] Solver not ready, ignoring action');
            return;
        }

        // Skip non-game actions
        if (actionType === 'next-hand') {
            return;
        }

        const actionStr = actionToString(actionType, amount);
        const newHistory = [...actionHistory, actionStr];

        console.log('[SolverContext] Adding action:', actionStr, 'New history:', newHistory);

        setActionHistory(newHistory);
        solver.getStrategyForHistory(newHistory);
    }, [solver.isReady, solver.getStrategyForHistory, actionHistory, actionToString]);

    /**
     * Reset action history
     */
    const resetHistory = useCallback(() => {
        setActionHistory([]);
        if (solver.isReady) {
            solver.getStrategyForHistory([]);
        }
    }, [solver.isReady, solver.getStrategyForHistory]);

    /**
     * Set action history directly (for manual navigation)
     */
    const setHistory = useCallback((history: string[]) => {
        setActionHistory(history);
        if (solver.isReady) {
            solver.getStrategyForHistory(history);
        }
    }, [solver.isReady, solver.getStrategyForHistory]);

    /**
     * Initialize solver with game state
     * This stores a snapshot and uses startHandStack for correct stack values
     */
    const initializeSolver = useCallback((state: GameState, heroSeat: number, config?: Partial<SolverConfig>) => {
        initialStateRef.current = state;
        setActionHistory([]);
        solver.runSolver(state, heroSeat, config);
    }, [solver.runSolver]);

    const value: SolverContextValue = {
        ...solver,
        actionHistory,
        addAction,
        resetHistory,
        setActionHistory: setHistory,
        initializeSolver,
    };

    return (
        <SolverContext.Provider value={value}>
            {children}
        </SolverContext.Provider>
    );
};

// ============================================================================
// HOOK
// ============================================================================

export const useSolverContext = (): SolverContextValue => {
    const context = useContext(SolverContext);
    if (!context) {
        throw new Error('useSolverContext must be used within a SolverProvider');
    }
    return context;
};
