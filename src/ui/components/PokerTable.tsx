import React from 'react';
import { GameState, ActionType, Player } from '../../core/types';
import { ReplayControls } from '../hooks/usePokerEngine';
import { Seat } from './Seat';
import { CommunityCards } from './CommunityCards';
import { PotDisplay } from './PotDisplay';
import { Controls } from './Controls';
import { getPlayerPositionLabel } from '../../utils/positions';
import { ScalableContainer } from './ScalableContainer';

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
        <div className="flex flex-col h-full bg-gray-900 overflow-hidden">
            {/* Table Area */}
            <div className="flex-1 relative overflow-hidden">
                {/* Replay Mode Overlay */}
                {!isLive && (
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
                        <div className="bg-yellow-600/90 text-white px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2">
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                            VIEWING PAST STATE
                        </div>
                    </div>
                )}

                {/* Stats Panel (HUD) removed - moved to sidebar */}

                <ScalableContainer targetWidth={1000} targetHeight={550}>
                    {/* The Felt */}
                    <div className={`relative w-[900px] h-[450px] bg-green-800 rounded-[100px] border-[16px] border-gray-800 shadow-2xl flex flex-col items-center justify-center ${!isLive ? 'opacity-80' : ''}`}>
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
                </ScalableContainer>
            </div>

            {/* Bottom Toolbar: Replay + Controls in one row */}
            <div className="flex items-center bg-gray-900/95 backdrop-blur border-t border-white/10 shrink-0">
                {/* Replay Controls (left side) */}
                {replay && (
                    <div className="flex items-center gap-2 px-3 py-2 border-r border-white/10">
                        <button
                            onClick={replay.goToStart}
                            disabled={replay.currentStep === 0}
                            className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white text-xs disabled:opacity-40"
                            title="Start"
                        >⏮</button>
                        <button
                            onClick={replay.stepBack}
                            disabled={replay.currentStep === 0}
                            className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white text-xs disabled:opacity-40"
                            title="Back"
                        >◀</button>
                        <button
                            onClick={replay.toggleAutoPlay}
                            disabled={isLive && !replay.isAutoPlaying}
                            className={`p-1.5 rounded text-white text-xs ${replay.isAutoPlaying ? 'bg-yellow-600' : 'bg-purple-600 hover:bg-purple-500'} disabled:opacity-40`}
                            title={replay.isAutoPlaying ? "Pause" : "Play"}
                        >{replay.isAutoPlaying ? '⏸' : '▶'}</button>
                        <button
                            onClick={replay.stepForward}
                            disabled={isLive}
                            className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white text-xs disabled:opacity-40"
                            title="Forward"
                        >▶</button>
                        <button
                            onClick={replay.goLive}
                            disabled={isLive}
                            className={`p-1.5 rounded text-white text-xs ${isLive ? 'bg-green-700' : 'bg-green-600 hover:bg-green-500 animate-pulse'} disabled:opacity-40`}
                            title="Live"
                        >⏭</button>
                        <input
                            type="range"
                            min={0}
                            max={replay.totalSteps - 1}
                            value={replay.currentStep}
                            onChange={(e) => replay.goToStep(Number(e.target.value))}
                            className="w-24 h-1.5 bg-gray-600 rounded appearance-none cursor-pointer accent-blue-500"
                        />
                        <span className="text-xs text-gray-400 font-mono w-14">
                            {replay.currentStep + 1}/{replay.totalSteps}
                        </span>
                        {isLive ? (
                            <span className="flex items-center gap-1 text-green-400 text-xs font-bold">
                                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                                LIVE
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-yellow-400 text-xs font-bold">
                                <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></span>
                                REPLAY
                            </span>
                        )}
                    </div>
                )}

                {/* Action Controls (right side, takes remaining space) */}
                <div className="flex-1">
                    <Controls
                        state={state}
                        onDispatch={onDispatch}
                        heroSeat={heroSeat}
                        isLive={isLive}
                        onGoLive={replay?.goLive}
                    />
                </div>
            </div>
        </div>
    );
};
