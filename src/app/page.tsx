'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePokerEngine } from '@/ui/hooks/usePokerEngine';
import { PokerTable } from '@/ui/components/PokerTable';
import { GameSetupModal } from '@/ui/components/GameSetupModal';
import { StudioLayout } from '@/ui/layouts/StudioLayout';
import { SelectionProvider } from '@/contexts/SelectionContext';
import { SolverProvider, useSolverContext } from '@/contexts/SolverContext';
import { HandConfig, ScenarioConfig, ActionType } from '@/core/types';

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

// Inner component that uses SolverContext
function HomeContent() {
  const { state, dispatch, resetGame, nextHand, error, replay } = usePokerEngine(INITIAL_CONFIG);
  const { addAction, resetHistory, isReady } = useSolverContext();

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

  /**
   * Wrapped dispatch that also updates solver history
   * When player makes an action on the table, we:
   * 1. Update GameState via dispatch (visual update)
   * 2. Update solver history via addAction (GTO strategy update)
   */
  const handleDispatch = useCallback((type: ActionType, amount?: number) => {
    // First, dispatch to game engine
    dispatch(type, amount);

    // Then, update solver history (if solver is ready)
    // Skip 'next-hand' as it's not a game action
    if (isReady && type !== 'next-hand') {
      addAction(type, amount);
    }
  }, [dispatch, addAction, isReady]);

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
    resetHistory(); // Reset solver history when starting new scenario
    resetGame(handConfig, config);
    setShowSetup(false);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      {/* Top Bar Controls */}
      <GameControls
        state={state}
        onNextHand={nextHand}
        onReset={() => {
          resetHistory();
          resetGame({ ...INITIAL_CONFIG, seed: Date.now() });
        }}
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
              onDispatch={handleDispatch}
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
  );
}

export default function Home() {
  return (
    <SelectionProvider>
      <SolverProvider>
        <HomeContent />
      </SolverProvider>
    </SelectionProvider>
  );
}
