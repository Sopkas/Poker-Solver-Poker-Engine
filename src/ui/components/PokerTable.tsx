import React from 'react';
import { GameState, ActionType, Player } from '../../core/types';
import { ReplayControls } from '../hooks/usePokerEngine';
import { Seat } from './Seat';
import { CommunityCards } from './CommunityCards';
import { PotDisplay } from './PotDisplay';
import { Controls } from './Controls';
import { ReplayBar } from './ReplayBar';
import { StatsPanel } from './StatsPanel';
import { getPlayerPositionLabel } from '../../utils/positions';

interface PokerTableProps {
    state: GameState;
    onDispatch: (type: ActionType, amount?: number) => void;
    heroSeat: number;
    godMode: boolean;
    /** Replay controls from usePokerEngine */
    replay?: ReplayControls;
}

export const PokerTable: React.FC<PokerTableProps> = ({
    state,
    onDispatch,
    heroSeat,
    godMode,
    replay
}) => {
    // Calculate positions for a 6-max table (ellipse)
    const getPosition = (seatIndex: number, totalSeats: number) => {
        // Static positions: Seat 0 is always bottom center
        // We map seatIndex directly to the positions array

        // 6-max positions:
        // 0: Bottom (Hero/Seat 0)
        // 1: Bottom Left
        // 2: Top Left
        // 3: Top
        // 4: Top Right
        // 5: Bottom Right

        // Using percentage for absolute positioning
        const positions = [
            { bottom: '5%', left: '50%', transform: 'translateX(-50%)' }, // Seat 0
            { bottom: '10%', left: '5%' }, // Seat 1
            { top: '10%', left: '5%' }, // Seat 2
            { top: '5%', left: '50%', transform: 'translateX(-50%)' }, // Seat 3
            { top: '10%', right: '5%' }, // Seat 4
            { bottom: '10%', right: '5%' }, // Seat 5
        ];

        return positions[seatIndex] || { top: '50%', left: '50%' };
    };

    const isLive = replay?.isLive ?? true;

    return (
        <div className="flex flex-col h-screen bg-gray-900 overflow-hidden">
            {/* Table Area */}
            <div className="flex-1 relative flex items-center justify-center p-8">
                {/* Replay Mode Overlay */}
                {!isLive && (
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
                        <div className="bg-yellow-600/90 text-white px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2">
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                            VIEWING PAST STATE
                        </div>
                    </div>
                )}

                {/* Stats Panel (HUD) */}
                <StatsPanel state={state} heroSeat={heroSeat} />

                {/* The Felt */}
                <div className={`relative w-full max-w-4xl aspect-[2/1] bg-green-800 rounded-[100px] border-[16px] border-gray-800 shadow-2xl flex flex-col items-center justify-center ${!isLive ? 'opacity-80' : ''}`}>
                    {/* Center Info */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
                        <PotDisplay pots={state.pots} />
                        <CommunityCards cards={state.communityCards} />

                        {state.street === 'showdown' && (
                            <div className="bg-red-600 text-white px-4 py-1 rounded font-bold animate-pulse">
                                SHOWDOWN
                            </div>
                        )}
                    </div>

                    {/* Seats */}
                    {state.players.map((player) => (
                        <Seat
                            key={player.id}
                            player={player}
                            isActive={state.actionSeat === player.seat && state.street !== 'showdown'}
                            isDealer={state.dealerSeat === player.seat}
                            isHero={player.seat === heroSeat}
                            godMode={godMode}
                            showCards={state.street === 'showdown'}
                            isWinner={state.winners?.some(w => w.playerId === player.id)}
                            positionStyle={getPosition(player.seat, state.config.maxSeats)}
                            positionLabel={getPlayerPositionLabel(player.seat, state.dealerSeat, state.players.length)}
                        />
                    ))}
                </div>
            </div>

            {/* Replay Bar (if replay controls provided) */}
            {replay && (
                <ReplayBar state={state} replay={replay} />
            )}

            {/* Controls Bar */}
            <Controls
                state={state}
                onDispatch={onDispatch}
                heroSeat={heroSeat}
                isLive={isLive}
                onGoLive={replay?.goLive}
            />
        </div>
    );
};
