import React from 'react';
import { Pot } from '../../core/types';

interface PotDisplayProps {
    pots: Pot[];
}

export const PotDisplay: React.FC<PotDisplayProps> = ({ pots }) => {
    if (pots.length === 0) return null;

    return (
        <div className="flex flex-col items-center gap-1">
            <div className="text-white/80 text-xs uppercase tracking-widest">Total Pot</div>
            <div className="text-2xl font-bold text-yellow-400 drop-shadow-md">
                {pots.reduce((sum, p) => sum + p.amount, 0)}
            </div>

            {/* Side Pots */}
            {pots.length > 1 && (
                <div className="flex gap-2 text-xs text-gray-400 mt-1">
                    {pots.map((pot, i) => (
                        <span key={i} className="bg-black/30 px-2 py-0.5 rounded">
                            {i === 0 ? 'Main' : `Side ${i}`}: {pot.amount}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};
