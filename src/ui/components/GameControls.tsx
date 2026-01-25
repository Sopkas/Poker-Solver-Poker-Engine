import React from 'react';
import Link from 'next/link';
import { GameState } from '../../core/types';

interface GameControlsProps {
    state: GameState;
    onNextHand: () => void;
    onReset: () => void;
    onNewScenario: () => void;
    godMode: boolean;
    onToggleGodMode: () => void;
    isLive: boolean;
    error: string | null;
}

export const GameControls: React.FC<GameControlsProps> = ({
    state,
    onNextHand,
    onReset,
    onNewScenario,
    godMode,
    onToggleGodMode,
    isLive,
    error
}) => {
    return (
        <div className="bg-gray-900 border-b border-gray-800 p-2 flex items-center justify-between shadow-md z-30 relative">
            <div className="flex items-center gap-4">
                <h1 className="text-sm font-bold text-yellow-500 tracking-wider px-2">POKER SOLVER v2.0</h1>

                <div className="h-6 w-px bg-gray-700 mx-2"></div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={onNextHand}
                        disabled={!state.winners || !isLive}
                        className={`px-3 py-1 text-xs rounded font-bold transition-colors ${state.winners && isLive
                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        Next Hand
                    </button>
                    <button
                        onClick={onReset}
                        className="bg-gray-800 text-gray-300 px-3 py-1 text-xs rounded hover:bg-red-900/50 hover:text-red-400 font-bold transition-colors"
                    >
                        Reset
                    </button>
                    <button
                        onClick={onNewScenario}
                        className="bg-gray-800 text-gray-300 px-3 py-1 text-xs rounded hover:bg-purple-900/50 hover:text-purple-400 font-bold transition-colors"
                    >
                        Scenario
                    </button>
                </div>
            </div>

            {/* Center Status */}
            <div className="flex items-center gap-6 text-xs font-mono">
                <div className="flex items-center gap-2">
                    <span className="text-gray-500">STREET</span>
                    <span className="text-blue-400 uppercase">{state.street}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-gray-500">POT</span>
                    <span className="text-green-400">${state.pots.reduce((s, p) => s + p.amount, 0)}</span>
                </div>
                {error && (
                    <div className="text-red-500 font-bold animate-pulse">
                        ! {error}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={onToggleGodMode}
                    className={`px-3 py-1 text-xs rounded font-bold transition-colors ${godMode
                        ? 'bg-green-900/30 text-green-400 border border-green-800'
                        : 'bg-gray-800 text-gray-500'}`}
                >
                    GOD MODE: {godMode ? 'ON' : 'OFF'}
                </button>

                <Link
                    href="/solver"
                    className="text-xs font-bold text-cyan-500 hover:text-cyan-400 transition-colors"
                >
                    TOOLS
                </Link>
            </div>
        </div>
    );
};
