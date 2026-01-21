'use client';

import React, { useState } from 'react';
import { usePokerEngine } from '../../ui/hooks/usePokerEngine';
import { PokerTable } from '../../ui/components/PokerTable';
import { HandConfig } from '../../core/types';

// Initial Config for testing
const INITIAL_CONFIG: HandConfig = {
    id: 'hand-1',
    players: [
        { id: 'p1', name: 'Hero', stack: 1000, seat: 0 },
        { id: 'p2', name: 'Villain 1', stack: 1000, seat: 1 },
        { id: 'p3', name: 'Villain 2', stack: 1000, seat: 2 },
        { id: 'p4', name: 'Villain 3', stack: 1000, seat: 3 },
        { id: 'p5', name: 'Villain 4', stack: 1000, seat: 4 },
        { id: 'p6', name: 'Villain 5', stack: 1000, seat: 5 },
    ],
    tableConfig: {
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
        ante: 0,
    },
    dealerSeat: 0,
    seed: 12345,
};

export default function PokerPage() {
    const { state, dispatch, resetGame, nextHand, error, replay } = usePokerEngine(INITIAL_CONFIG);

    // Hero switching for testing
    const [heroSeat, setHeroSeat] = useState(0);

    // Auto-switch hero to active player (God Mode for testing)
    const [godMode, setGodMode] = useState(true);

    React.useEffect(() => {
        if (godMode && replay.isLive) {
            setHeroSeat(state.actionSeat);
        }
    }, [state.actionSeat, godMode, replay.isLive]);

    return (
        <div className="relative">
            {/* Debug / Config Overlay */}
            <div className="absolute top-4 left-4 z-50 bg-black/80 text-white p-4 rounded text-xs">
                <h3 className="font-bold mb-2">Debug Controls</h3>
                <div className="flex gap-2 mb-2">
                    <button
                        onClick={() => resetGame({ ...INITIAL_CONFIG, seed: Date.now() })}
                        className="bg-red-600 px-2 py-1 rounded hover:bg-red-500"
                    >
                        Reset Game
                    </button>
                    {state.street === 'showdown' && replay.isLive && (
                        <button
                            onClick={nextHand}
                            className="bg-blue-600 px-2 py-1 rounded hover:bg-blue-500 animate-pulse"
                        >
                            Next Hand
                        </button>
                    )}
                    <button
                        onClick={() => setGodMode(!godMode)}
                        className={`px-2 py-1 rounded ${godMode ? 'bg-green-600' : 'bg-gray-600'}`}
                    >
                        God Mode: {godMode ? 'ON' : 'OFF'}
                    </button>
                </div>
                <div>
                    Street: {state.street} <br />
                    Pot: {state.pots.reduce((s, p) => s + p.amount, 0)} <br />
                    Min Raise: {state.minRaise}
                </div>
                {error && (
                    <div className="mt-2 text-red-400 font-bold">
                        Error: {error}
                    </div>
                )}
            </div>

            <PokerTable
                state={state}
                onDispatch={dispatch}
                heroSeat={heroSeat}
                godMode={godMode}
                replay={replay}
            />
        </div>
    );
}
