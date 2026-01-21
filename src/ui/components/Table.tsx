import React from 'react';
import { GameState, Player as PlayerType } from '@/core/types';
import { Player } from './Player';
import { Card } from './Card';

interface TableProps {
    state: GameState;
}

export const Table: React.FC<TableProps> = ({ state }) => {
    // Map seats to visual positions (6-max table layout)
    // Top row: seats 3, 4, 5
    // Bottom row: seats 0 (BTN), 1 (SB), 2 (BB)

    const getPlayerBySeat = (seat: number): PlayerType | undefined =>
        state.players.find(p => p.seat === seat);

    const renderPlayer = (seat: number, className: string) => {
        const player = getPlayerBySeat(seat);
        if (!player) return null;

        const isActive = player.seat === state.actionSeat;
        const isDealer = player.seat === state.dealerSeat;

        return (
            <div className={className}>
                <Player player={player} isActive={isActive} isDealer={isDealer} />
            </div>
        );
    };

    return (
        <div className="relative w-full max-w-4xl aspect-[2/1] bg-green-900 rounded-[100px] border-[16px] border-gray-800 shadow-2xl mx-auto my-8 flex items-center justify-center">
            {/* Board */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex gap-2">
                {state.communityCards.map((card, i) => (
                    <Card key={i} card={card} />
                ))}
                {state.communityCards.length === 0 && <div className="text-white/20 font-bold">PREFLOP</div>}
            </div>

            {/* Pots */}
            <div className="absolute top-[60%] left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-1">
                {state.pots.map((pot, i) => (
                    <div key={i} className={`font-mono bg-black/50 px-3 py-1 rounded-full ${i === 0 ? 'text-white' : 'text-yellow-300 text-xs'}`}>
                        {i === 0 ? 'Pot' : `Side ${i}`}: ${pot.amount}
                    </div>
                ))}
            </div>

            {/* Players - Absolute Positioning */}
            {/* Top Row: seats 3, 4, 5 */}
            {renderPlayer(3, "absolute top-[-40px] left-[20%]")}
            {renderPlayer(4, "absolute top-[-40px] left-[50%] transform -translate-x-1/2")}
            {renderPlayer(5, "absolute top-[-40px] right-[20%]")}

            {/* Bottom Row: seats 0, 1, 2 */}
            {renderPlayer(0, "absolute bottom-[-40px] right-[20%]")}
            {renderPlayer(1, "absolute bottom-[-40px] left-[50%] transform -translate-x-1/2")}
            {renderPlayer(2, "absolute bottom-[-40px] left-[20%]")}
        </div>
    );
};
