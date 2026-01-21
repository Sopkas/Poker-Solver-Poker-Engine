import { GameState, Action, HandConfig } from '../types';
import { createInitialState } from '../state';

/**
 * ReplayController for stepping through recorded hand history.
 * Uses the new GameState type.
 */
export class ReplayController {
    private initialConfig: HandConfig;
    private history: Action[];
    private currentState: GameState;
    private currentIndex: number = 0;

    constructor(config: HandConfig, history: Action[]) {
        this.initialConfig = config;
        this.history = history;
        this.currentState = createInitialState(config);
    }

    public getState(): GameState {
        return this.currentState;
    }

    public getProgress(): { current: number; total: number } {
        return { current: this.currentIndex, total: this.history.length };
    }

    /**
     * Steps forward one action in the history.
     * Note: This is a placeholder - full action application logic needs to be implemented.
     */
    public stepForward(): boolean {
        if (this.currentIndex >= this.history.length) return false;

        // For now, just increment the index.
        // Full action application requires additional implementation.
        this.currentIndex++;

        return true;
    }

    public stepBack(): boolean {
        if (this.currentIndex === 0) return false;
        this.jumpTo(this.currentIndex - 1);
        return true;
    }

    public jumpTo(index: number): void {
        if (index < 0 || index > this.history.length) throw new Error("Index out of bounds");

        if (index < this.currentIndex) {
            this.currentState = createInitialState(this.initialConfig);
            this.currentIndex = 0;
        }

        while (this.currentIndex < index) {
            this.stepForward();
        }
    }

    public autoPlay(delayMs: number, onUpdate: (state: GameState) => void): void {
        const interval = setInterval(() => {
            if (!this.stepForward()) {
                clearInterval(interval);
            } else {
                onUpdate(this.currentState);
            }
        }, delayMs);
    }
}
