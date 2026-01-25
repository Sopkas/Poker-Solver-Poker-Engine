'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePokerEngine } from '@/ui/hooks/usePokerEngine';
import { PokerTable } from '@/ui/components/PokerTable';
import { GameSetupModal } from '@/ui/components/GameSetupModal';
import { StudioLayout } from '@/ui/layouts/StudioLayout';
import { SelectionProvider } from '@/contexts/SelectionContext';
import { HandConfig, ScenarioConfig } from '@/core/types';

import { RangeMatrix } from '@/ui/components/tools/RangeMatrix';
import { GameControls } from '@/ui/components/GameControls';
import { SidebarTabs } from '@/ui/components/layout/SidebarTabs';
import { StatsTab } from '@/ui/components/tools/StatsTab';
import { SolverPanel } from '@/ui/components/tools/SolverPanel';

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
    <SelectionProvider>
      <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
        {/* Top Bar Controls */}
        <GameControls
          state={state}
          onNextHand={nextHand}
          onReset={() => resetGame({ ...INITIAL_CONFIG, seed: Date.now() })}
          onNewScenario={() => setShowSetup(true)}
          godMode={godMode}
          onToggleGodMode={() => setGodMode(!godMode)}
          isLive={replay.isLive}
          error={error}
        />

        {/* Main Split Layout */}
        <div className="flex-1 min-h-0">
          <StudioLayout
            sidebar={
              <SidebarTabs
                tabs={[
                  { id: 'solver', label: 'Solver', content: <SolverPanel state={state} heroSeat={heroSeat} /> },
                  { id: 'ranges', label: 'Ranges', content: <RangeMatrix /> },
                  { id: 'stats', label: 'Stats', content: <StatsTab state={state} heroSeat={heroSeat} /> }
                ]}
                defaultTabId="solver"
              />
            }
          >
            <div className="relative h-full bg-gray-950">
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
          </StudioLayout>
        </div>
      </div>
    </SelectionProvider>
  );
}
