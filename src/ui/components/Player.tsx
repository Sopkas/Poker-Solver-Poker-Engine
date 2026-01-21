import React from 'react';
import { Player as PlayerType, Card as CardType } from '@/core/types';
import { Card } from './Card';

interface PlayerProps {
    player: PlayerType;
    isActive: boolean;
    isDealer: boolean;
    className?: string;
}

export const Player: React.FC<PlayerProps> = ({ player, isActive, isDealer, className = '' }) => {
    return (
        <div className={`flex flex-col items-center p-2 rounded-lg transition-all ${isActive ? 'bg-yellow-500/20 border-2 border-yellow-500' : 'bg-gray-800/50 border border-gray-700'} ${className}`}>
            {/* Cards */}
            <div className="flex space-x-1 mb-2">
                {player.holeCards && player.holeCards.length >= 2 ? (
                    <>
                        <Card card={player.holeCards[0]} />
                        <Card card={player.holeCards[1]} />
                    </>
                ) : (
                    <>
                        <Card card={undefined} />
                        <Card card={undefined} />
                    </>
                )}
            </div>

            {/* Info */}
            <div className="text-center">
                <div className="font-bold text-white text-sm flex items-center justify-center gap-1">
                    {player.id}
                    {isDealer && <span className="w-4 h-4 bg-white text-black rounded-full text-[10px] flex items-center justify-center">D</span>}
                </div>
                <div className="text-green-400 text-xs font-mono">${player.stack}</div>
                {player.bet > 0 && (
                    <div className="mt-1 bg-black/40 px-2 py-0.5 rounded text-xs text-yellow-300">
                        Bet: {player.bet}
                    </div>
                )}
                {player.status === 'folded' && <div className="text-gray-500 text-xs uppercase font-bold">Folded</div>}
                {player.status === 'all-in' && <div className="text-red-500 text-xs uppercase font-bold">All-In</div>}
            </div>
        </div>
    );
};
