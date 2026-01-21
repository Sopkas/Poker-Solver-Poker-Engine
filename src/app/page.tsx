'use client';

import React, { useState } from 'react';
import { usePokerEngine } from '@/ui/hooks/usePokerEngine';
import { PokerTable } from '@/ui/components/PokerTable';
import { GameSetupModal } from '@/ui/components/GameSetupModal';
import { HandConfig, ScenarioConfig } from '@/core/types';

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

export default function Home() {
  const { state, dispatch, resetGame, nextHand, error, replay } = usePokerEngine(INITIAL_CONFIG);

  // Hero switching for testing
  const [heroSeat, setHeroSeat] = useState(0);

  // Auto-switch hero to active player (God Mode for testing)
  const [godMode, setGodMode] = useState(true);

  // Show/Hide Setup Modal
  const [showSetup, setShowSetup] = useState(false);

  React.useEffect(() => {
    if (godMode && replay.isLive) {
      setHeroSeat(state.actionSeat);
    }
  }, [state.actionSeat, godMode, replay.isLive]);

  const handleStartScenario = (config: ScenarioConfig) => {
    // Convert ScenarioConfig to HandConfig
    const players = Array.from({ length: config.numPlayers }).map((_, i) => {
      const override = config.players?.find(p => p.seat === i);
      return {
        id: `p${i + 1}`,
        name: override?.name || (i === config.heroSeat ? 'Hero' : `Villain ${i}`),
        stack: override?.stack || config.startingStack,
        seat: i,
      };
    });

    const handConfig: HandConfig = {
      id: `hand-${Date.now()}`,
      players,
      tableConfig: {
        maxSeats: Math.max(6, config.numPlayers), // Ensure table is big enough
        smallBlind: config.smallBlind,
        bigBlind: config.bigBlind,
        ante: 0,
      },
      dealerSeat: config.dealerSeat !== undefined ? config.dealerSeat : 0,
      seed: Date.now(),
    };

    setHeroSeat(config.heroSeat);
    setGodMode(false); // Disable god mode so we stick to hero
    resetGame(handConfig, config);
    setShowSetup(false);
  };

  return (
    <div className="relative min-h-screen bg-gray-950">
      {/* Debug / Config Overlay */}
      <div className="absolute top-4 left-4 z-50 bg-black/80 text-white p-4 rounded text-xs border border-white/10 max-w-[180px]">
        <h3 className="font-bold mb-4 text-yellow-400 text-center">Poker Engine v0.5</h3>
        <div className="flex flex-col gap-2 mb-4">
          <button
            onClick={nextHand}
            disabled={!state.winners || !replay.isLive}
            className={`px-3 py-1 rounded font-bold ${state.winners && replay.isLive
              ? 'bg-blue-600 hover:bg-blue-500'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
          >
            Next Hand
          </button>
          <button
            onClick={() => resetGame({ ...INITIAL_CONFIG, seed: Date.now() })}
            className="bg-red-600 px-3 py-1 rounded hover:bg-red-500 font-bold"
          >
            Reset
          </button>
          <button
            onClick={() => setShowSetup(true)}
            className="bg-purple-600 px-3 py-1 rounded hover:bg-purple-500 font-bold"
          >
            New Scenario
          </button>
          <button
            onClick={() => setGodMode(!godMode)}
            className={`px-3 py-1 rounded font-bold ${godMode ? 'bg-green-600' : 'bg-gray-600'}`}
          >
            God Mode: {godMode ? 'ON' : 'OFF'}
          </button>
        </div>
        <div className="font-mono space-y-1">
          <div>Street: <span className="text-blue-400">{state.street}</span></div>
          <div>Pot: <span className="text-green-400">${state.pots.reduce((s, p) => s + p.amount, 0)}</span></div>
          <div>Min Raise: <span className="text-orange-400">${state.minRaise}</span></div>
        </div>
        {error && (
          <div className="mt-2 text-red-400 font-bold bg-red-900/20 p-2 rounded border border-red-500/50">
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

      {showSetup && (
        <GameSetupModal
          onStart={handleStartScenario}
          onClose={() => setShowSetup(false)}
        />
      )}
    </div>
  );
}
