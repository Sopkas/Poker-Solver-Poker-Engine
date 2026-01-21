import React from 'react';
import { Player, Card as CardType } from '../../core/types';
import { Card } from './Card';

interface SeatProps {
    player: Player;
    isActive: boolean;
    isDealer: boolean;
    isHero: boolean;
    godMode: boolean;
    showCards: boolean; // Force show cards (e.g. at showdown)
    isWinner?: boolean;
    positionStyle: React.CSSProperties;
    positionLabel: string;
}

export const Seat: React.FC<SeatProps> = ({
    player,
    isActive,
    isDealer,
    isHero,
    godMode,
    showCards,
    isWinner,
    positionStyle,
    positionLabel
}) => {
    const isFolded = player.status === 'folded';
    const isAllIn = player.status === 'all-in';

    // Determine if we should show card faces
    const revealCards = (isHero || showCards || godMode) && !isFolded;

    return (
        <div
            className={`absolute flex flex-col items-center transition-all duration-300 ${isFolded ? 'opacity-50 grayscale' : ''}`}
            style={positionStyle}
        >
            {/* Cards */}
            <div className="flex -space-x-4 mb-2 relative z-10">
                {/* Position Label */}
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-400 z-50 shadow-sm">
                    {positionLabel}
                </div>
                {player.holeCards.map((card, i) => (
                    <div key={i} className={`transform ${i === 1 ? 'rotate-6 translate-y-1' : '-rotate-6'}`}>
                        <Card card={card} hidden={!revealCards} />
                    </div>
                ))}
            </div>

            {/* Player Info Bubble */}
            <div className={`
        relative px-4 py-2 rounded-lg border-2 min-w-[120px] text-center shadow-lg backdrop-blur-md
        ${isWinner ? 'bg-green-600 border-green-400 scale-110 z-30 shadow-[0_0_20px_rgba(74,222,128,0.5)] text-white' :
                    isActive ? 'bg-yellow-100 border-yellow-400 scale-110 z-20 text-black' :
                        'bg-gray-800/90 border-gray-600 text-white'}
      `}>


                {/* Name removed as per request */}
                <div className="text-xs font-mono">
                    {isAllIn ? <span className="text-red-500 font-bold">ALL-IN</span> : player.stack}
                </div>

                {/* Dealer Button */}
                {isDealer && (
                    <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-white text-black rounded-full flex items-center justify-center border-2 border-gray-300 font-bold text-xs shadow-sm z-50">
                        D
                    </div>
                )}
            </div>

            {/* Current Bet */}
            {player.bet > 0 && (
                <div className="mt-2 bg-black/50 text-white px-2 py-0.5 rounded-full text-xs font-mono border border-white/20">
                    {player.bet}
                </div>
            )}
        </div>
    );
};
