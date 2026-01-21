import { useState, useCallback, useRef, useEffect } from 'react';
import {
    GameState,
    ActionType,
    Action,
    HandConfig,
    Player,
    ScenarioConfig
} from '../../core/types';
import { Engine } from '../../core/engine';
import { Rules } from '../../core/rules';
import { Showdown } from '../../core/showdown';
import { createInitialState, prepareNextHand } from '../../core/state';

// --- Types ---

export interface ReplayControls {
    /** Current step index in history */
    currentStep: number;
    /** Total number of steps in history */
    totalSteps: number;
    /** Whether we're viewing the latest state */
    isLive: boolean;
    /** Go to specific step */
    goToStep: (step: number) => void;
    /** Go back one step */
    stepBack: () => void;
    /** Go forward one step */
    stepForward: () => void;
    /** Jump to latest state */
    goLive: () => void;
    /** Jump to start */
    goToStart: () => void;
    /** Auto-play state */
    isAutoPlaying: boolean;
    /** Toggle auto-play */
    toggleAutoPlay: () => void;
    /** Stop auto-play */
    stopAutoPlay: () => void;
}

export interface PokerEngine {
    /** Current view state (may be historical) */
    state: GameState;
    /** Dispatch action (only works when isLive) */
    dispatch: (type: ActionType, amount?: number) => void;
    /** Reset game with new config */
    resetGame: (config: HandConfig, scenarioConfig?: ScenarioConfig) => void;
    /** Start next hand */
    nextHand: () => void;
    /** Current error message */
    error: string | null;
    /** Replay/time travel controls */
    replay: ReplayControls;
}

// --- Hook Implementation ---

export const usePokerEngine = (initialConfig: HandConfig): PokerEngine => {
    // History stack: array of all states
    const [history, setHistory] = useState<GameState[]>(() => [createInitialState(initialConfig)]);
    // Current step index
    const [currentStep, setCurrentStep] = useState(0);
    // Error state
    const [error, setError] = useState<string | null>(null);
    // Auto-play state
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    // Auto-play interval ref
    const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

    // Derived values
    const totalSteps = history.length;
    const isLive = currentStep === totalSteps - 1;
    const state = history[currentStep];

    // Helper to process auto-transitions (Street ends, Showdown, etc.)
    const processAutoTransitions = (currentState: GameState): GameState => {
        let newState = currentState;
        let loopCount = 0;
        const MAX_LOOPS = 10; // Prevent infinite loops

        while (loopCount < MAX_LOOPS) {
            loopCount++;

            // 1. Check for Single Survivor (Game Over immediately)
            if (Rules.isSingleSurvivor(newState)) {
                if (newState.pots.length > 0) {
                    return Showdown.resolveSingleWinner(newState);
                }
                return newState;
            }

            // 2. Check if Street is Complete
            if (Rules.isStreetComplete(newState)) {
                const activePlayers = newState.players.filter(p => p.status === 'active');

                if (activePlayers.length === 0 && newState.street !== 'showdown') {
                    newState = Engine.runOutBoard(newState);
                    continue;
                }

                newState = Engine.advanceStreet(newState);

                if (newState.street === 'showdown') {
                    if (newState.pots.length > 0) {
                        newState = Showdown.resolveShowdown(newState);
                    }
                    return newState;
                }

                return newState;
            }

            break;
        }

        return newState;
    };

    // --- Replay Controls ---

    const goToStep = useCallback((step: number) => {
        const clampedStep = Math.max(0, Math.min(step, history.length - 1));
        setCurrentStep(clampedStep);
    }, [history.length]);

    const stepBack = useCallback(() => {
        setCurrentStep(prev => Math.max(0, prev - 1));
    }, []);

    const stepForward = useCallback(() => {
        setCurrentStep(prev => Math.min(history.length - 1, prev + 1));
    }, [history.length]);

    const goLive = useCallback(() => {
        setCurrentStep(history.length - 1);
    }, [history.length]);

    const goToStart = useCallback(() => {
        setCurrentStep(0);
    }, []);

    const stopAutoPlay = useCallback(() => {
        setIsAutoPlaying(false);
        if (autoPlayRef.current) {
            clearInterval(autoPlayRef.current);
            autoPlayRef.current = null;
        }
    }, []);

    const toggleAutoPlay = useCallback(() => {
        if (isAutoPlaying) {
            stopAutoPlay();
        } else {
            setIsAutoPlaying(true);
        }
    }, [isAutoPlaying, stopAutoPlay]);

    // Auto-play effect
    useEffect(() => {
        if (isAutoPlaying) {
            autoPlayRef.current = setInterval(() => {
                setCurrentStep(prev => {
                    if (prev >= history.length - 1) {
                        // Reached the end, stop auto-play
                        setIsAutoPlaying(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 1000);
        }

        return () => {
            if (autoPlayRef.current) {
                clearInterval(autoPlayRef.current);
                autoPlayRef.current = null;
            }
        };
    }, [isAutoPlaying, history.length]);

    // --- Game Actions ---

    const dispatch = useCallback((type: ActionType, amount: number = 0) => {
        // Safety: Only allow actions when viewing live state
        if (currentStep !== history.length - 1) {
            setError('Cannot act while viewing past states. Go Live to continue playing.');
            return;
        }

        setError(null);

        // Get the current live state
        const liveState = history[history.length - 1];

        try {
            // Use find by seat number, not array index
            const activePlayer = liveState.players.find(p => p.seat === liveState.actionSeat);

            if (!activePlayer) {
                throw new Error(`No player found at action seat ${liveState.actionSeat}`);
            }

            // Construct Action object
            const action: Action = {
                street: liveState.street,
                playerId: activePlayer.id,
                type,
                amount,
                isAllIn: false,
                timestamp: Date.now()
            };

            // Determine isAllIn
            if (type === 'bet' || type === 'raise' || type === 'call') {
                let cost = 0;
                if (type === 'call') {
                    cost = Math.min(activePlayer.stack, liveState.currentBet - activePlayer.bet);
                } else {
                    cost = amount;
                }
                if (cost >= activePlayer.stack) {
                    action.isAllIn = true;
                }
            }

            // Apply action
            let newState = Engine.applyAction(liveState, action);

            // Handle auto-transitions
            newState = processAutoTransitions(newState);

            // Add to history and advance step
            setHistory(prev => [...prev, newState]);
            setCurrentStep(prev => prev + 1);

        } catch (err: any) {
            console.error("Action Error:", err);
            setError(err.message || "Unknown error");
        }
    }, [currentStep, history]);

    const resetGame = useCallback((config: HandConfig, scenarioConfig?: ScenarioConfig) => {
        const initialState = createInitialState(config, scenarioConfig);
        setHistory([initialState]);
        setCurrentStep(0);
        setError(null);
        stopAutoPlay();
    }, [stopAutoPlay]);

    const nextHand = useCallback(() => {
        // Safety: Only allow when live
        if (currentStep !== history.length - 1) {
            setError('Go Live to start next hand.');
            return;
        }

        const liveState = history[history.length - 1];

        try {
            const newState = prepareNextHand(liveState);
            // Start fresh history for new hand
            setHistory([newState]);
            setCurrentStep(0);
            setError(null);
        } catch (err: any) {
            console.error("Next Hand Error:", err);
            setError(err.message || "Failed to start next hand");
        }
    }, [currentStep, history]);

    // --- Return Hook Interface ---

    return {
        state,
        dispatch,
        resetGame,
        nextHand,
        error,
        replay: {
            currentStep,
            totalSteps,
            isLive,
            goToStep,
            stepBack,
            stepForward,
            goLive,
            goToStart,
            isAutoPlaying,
            toggleAutoPlay,
            stopAutoPlay,
        }
    };
};
