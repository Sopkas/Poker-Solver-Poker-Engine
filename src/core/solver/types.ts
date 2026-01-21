import { Action, GameState } from '../types';

export type NodeType = 'action' | 'showdown' | 'terminal_fold';

export interface SolverNode {
    id: string; // Unique hash/ID
    state: GameState; // The engine state at this point
    type: NodeType;
    children: SolverEdge[];

    // For Solver (Phase 9) - Just placeholders for now
    pot: number;
    activePlayer: number;
}

export interface SolverEdge {
    action: Action; // The action taken to get here (e.g., "bet 500")
    nextNode: SolverNode;
}

export interface TreeConfig {
    betSizes: {
        flop: number[];
        turn: number[];
        river: number[];
    };
    maxRaises: number; // Limit raises per street to prevent infinite loops
}
