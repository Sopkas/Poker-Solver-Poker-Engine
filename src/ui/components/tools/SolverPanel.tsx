import React, { useState, useCallback } from 'react';
import { GameState } from '../../../core/types';
import { useSolverContext } from '../../../contexts/SolverContext';
import { mapSolutionToGrid } from '../../../utils/solverMapping';
import { RangeMatrix } from './RangeMatrix';

// ============================================================================
// TYPES
// ============================================================================

interface SolverPanelProps {
    state: GameState;
    heroSeat: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const SolverPanel: React.FC<SolverPanelProps> = ({ state, heroSeat }) => {
    const {
        isSolving,
        progress,
        solution,
        error,
        runSolver,
        cancelSolver,
        clearSolution,
        isReady,
        actionHistory,
        resetHistory,
        setActionHistory
    } = useSolverContext();
    const [iterations, setIterations] = useState(1000);
    const [showConfig, setShowConfig] = useState(false);

    const isRiver = state.street === 'river';
    const activePlayers = state.players.filter(p => p.status === 'active' || p.status === 'all-in');
    const isHeadsUp = activePlayers.length === 2;
    const canSolve = isRiver && isHeadsUp && state.communityCards.length === 5;

    const handleSolve = () => {
        resetHistory(); // Reset history when starting new solve
        runSolver(state, heroSeat, { iterations });
    };

    /**
     * Navigate to a specific action in the tree (for table buttons in solver panel)
     * Note: Actions from PokerTable are handled via SolverContext.addAction
     */
    const handleActionClick = useCallback((action: { type: string; amount: number }) => {
        console.log('[SolverPanel] handleActionClick called:', action, 'isReady:', isReady);

        if (!isReady) {
            console.warn('[SolverPanel] Not ready, ignoring click');
            return;
        }

        // Build the action string - simplify for Rust compatibility
        const actionStr = action.amount > 0
            ? `${action.type} ${action.amount}`
            : action.type;

        const newHistory = [...actionHistory, actionStr];
        console.log('[SolverPanel] Navigating to history:', newHistory);
        console.log('[SolverPanel] Action string:', actionStr);

        // Update history via context (also fetches strategy)
        setActionHistory(newHistory);
    }, [isReady, actionHistory, setActionHistory]);

    /**
     * Navigate back to a specific point in history
     */
    const handleHistoryClick = useCallback((index: number) => {
        if (!isReady) return;

        if (index < 0) {
            // Go back to root
            resetHistory();
        } else {
            const newHistory = actionHistory.slice(0, index + 1);
            setActionHistory(newHistory);
        }
    }, [isReady, actionHistory, setActionHistory, resetHistory]);

    /**
     * Reset to root node
     */
    const handleResetToRoot = useCallback(() => {
        if (!isReady) return;
        resetHistory();
    }, [isReady, resetHistory]);

    /**
     * Clear solution and reset state
     */
    const handleClearSolution = useCallback(() => {
        resetHistory();
        clearSolution();
    }, [clearSolution, resetHistory]);

    // Map solution to grid format
    const strategyGrid = solution ? mapSolutionToGrid(solution) : undefined;

    return (
        <div className="flex flex-col h-full bg-gray-900">
            {/* Header with Solve Button */}
            <div className="p-4 border-b border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-gray-300 uppercase tracking-wider">
                        GTO Solver
                    </h3>
                    <button
                        onClick={() => setShowConfig(!showConfig)}
                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                        {showConfig ? 'Hide Config' : 'Config'}
                    </button>
                </div>

                {/* Configuration Panel */}
                {showConfig && (
                    <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs text-gray-400">Iterations</label>
                            <select
                                value={iterations}
                                onChange={(e) => setIterations(Number(e.target.value))}
                                className="bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600"
                                disabled={isSolving}
                            >
                                <option value={500}>500 (Fast)</option>
                                <option value={1000}>1,000 (Default)</option>
                                <option value={2000}>2,000</option>
                                <option value={5000}>5,000 (Slow)</option>
                                <option value={10000}>10,000 (Very Slow)</option>
                            </select>
                        </div>
                        <p className="text-[10px] text-gray-500">
                            More iterations = better accuracy but slower solving
                        </p>
                    </div>
                )}

                {/* Status / Warnings */}
                {!canSolve && (
                    <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3">
                        <p className="text-xs text-yellow-400">
                            {!isRiver && 'Solver currently supports River only.'}
                            {isRiver && !isHeadsUp && 'Solver requires exactly 2 active players (Heads-Up).'}
                            {isRiver && isHeadsUp && state.communityCards.length !== 5 && 'Waiting for 5 community cards.'}
                        </p>
                    </div>
                )}

                {/* Error Display */}
                {error && (
                    <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3">
                        <p className="text-xs text-red-400">{error}</p>
                    </div>
                )}

                {/* Solve / Cancel Button */}
                {isSolving ? (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">Solving...</span>
                            <span className="text-xs font-mono text-blue-400">{progress}%</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all duration-200"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <button
                            onClick={cancelSolver}
                            className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <button
                            onClick={handleSolve}
                            disabled={!canSolve}
                            className={`flex-1 py-2.5 px-4 font-bold text-sm rounded-lg transition-all ${
                                canSolve
                                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg'
                                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            Solve GTO
                        </button>
                        {solution && (
                            <button
                                onClick={handleClearSolution}
                                className="py-2.5 px-4 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded-lg transition-colors"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                )}

                {/* Solution Stats */}
                {solution && !isSolving && (
                    <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Iterations</span>
                            <span className="text-white font-mono">{solution.iterations.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Infosets</span>
                            <span className="text-white font-mono">{solution.infosetCount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Time</span>
                            <span className="text-white font-mono">{(solution.timeMs / 1000).toFixed(2)}s</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Position</span>
                            <span className="text-white font-mono">
                                {solution.heroPosition === 0 ? 'OOP' : 'IP'}
                            </span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Pot</span>
                            <span className="text-white font-mono">{solution.pot}</span>
                        </div>
                    </div>
                )}

                {/* Action History Breadcrumb */}
                {solution && !isSolving && isReady && (
                    <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={handleResetToRoot}
                                className={`text-xs px-2 py-1 rounded transition-colors ${
                                    actionHistory.length === 0
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                            >
                                Root
                            </button>
                            {actionHistory.map((action, idx) => (
                                <React.Fragment key={idx}>
                                    <span className="text-gray-500 text-xs">→</span>
                                    <button
                                        onClick={() => handleHistoryClick(idx)}
                                        className={`text-xs px-2 py-1 rounded transition-colors ${
                                            idx === actionHistory.length - 1
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                    >
                                        {action}
                                    </button>
                                </React.Fragment>
                            ))}
                        </div>

                        {/* Terminal Node Indicator */}
                        {solution.isTerminal && (
                            <div className="text-xs text-yellow-400 bg-yellow-900/30 rounded px-2 py-1">
                                Terminal node reached (showdown/fold)
                            </div>
                        )}
                    </div>
                )}

                {/* Current Node Info */}
                {solution && !isSolving && isReady && solution.nodeInfo && (
                    <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Current Player</span>
                            <span className="text-white font-mono">
                                {solution.nodeInfo.player === 0 ? 'OOP (Player 0)' :
                                 solution.nodeInfo.player === 1 ? 'IP (Player 1)' :
                                 solution.nodeInfo.player === 255 ? 'Showdown' :
                                 `Player ${solution.nodeInfo.player}`}
                            </span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Node Pot</span>
                            <span className="text-white font-mono">{solution.nodeInfo.pot?.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Node Index</span>
                            <span className="text-white font-mono">{solution.nodeInfo.nodeIdx}</span>
                        </div>
                    </div>
                )}

                {/* Available Actions - Click to Navigate */}
                {solution && !isSolving && isReady && !solution.isTerminal && solution.availableActions.length > 0 && (
                    <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                        <p className="text-xs text-gray-400">
                            {solution.nodeInfo?.player === 0 ? 'OOP to act:' :
                             solution.nodeInfo?.player === 1 ? 'IP to act:' :
                             'Click an action to navigate:'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {solution.availableActions.map((action, idx) => {
                                const actionLabel = action.amount > 0
                                    ? `${action.type} ${action.amount}`
                                    : action.type;

                                // Color-code by action type
                                const colorClass =
                                    action.type === 'fold' ? 'bg-red-700 hover:bg-red-600' :
                                    action.type === 'check' ? 'bg-green-700 hover:bg-green-600' :
                                    action.type === 'call' ? 'bg-green-700 hover:bg-green-600' :
                                    action.type === 'bet' ? 'bg-blue-700 hover:bg-blue-600' :
                                    action.type === 'raise' ? 'bg-purple-700 hover:bg-purple-600' :
                                    'bg-gray-700 hover:bg-gray-600';

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleActionClick(action)}
                                        className={`text-xs px-3 py-1.5 rounded text-white font-medium transition-colors ${colorClass}`}
                                    >
                                        {actionLabel}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Strategy Grid or Range Matrix */}
            <div className="flex-1 overflow-hidden">
                <RangeMatrix
                    strategyData={strategyGrid}
                    mode={strategyGrid ? 'strategy' : 'edit'}
                />
            </div>
        </div>
    );
};
