import React from 'react';
import { Card as CardType } from '../../core/types';
import { Card } from './Card';

interface CommunityCardsProps {
    cards: CardType[];
}

export const CommunityCards: React.FC<CommunityCardsProps> = ({ cards }) => {
    // Always render 5 slots, fill with cards or empty placeholders
    const slots = [0, 1, 2, 3, 4];

    return (
        <div className="flex gap-2 justify-center items-center p-4 bg-black/20 rounded-full border border-white/10 backdrop-blur-sm">
            {slots.map((i) => (
                <div key={i} className="transition-all duration-500 transform">
                    {cards[i] ? (
                        <Card card={cards[i]} className="w-12 h-16 text-lg" />
                    ) : (
                        <div className="w-12 h-16 border-2 border-dashed border-white/20 rounded bg-white/5" />
                    )}
                </div>
            ))}
        </div>
    );
};
