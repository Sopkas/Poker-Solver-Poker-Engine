import React from 'react';
import { Card as CardType } from '../../core/types';

interface CardProps {
    card?: CardType; // If undefined, renders back of card
    hidden?: boolean;
    className?: string;
}

const SUIT_ICONS: Record<string, string> = {
    'h': '♥',
    'd': '♦',
    'c': '♣',
    's': '♠',
};

const SUIT_COLORS: Record<string, string> = {
    'h': 'text-red-500',
    'd': 'text-blue-500', // Four-color deck
    'c': 'text-green-500',
    's': 'text-black',
};

export const Card: React.FC<CardProps> = ({ card, hidden, className = '' }) => {
    if (hidden || !card) {
        return (
            <div className={`w-10 h-14 bg-blue-800 rounded border-2 border-white shadow-md flex items-center justify-center ${className}`}>
                <div className="w-8 h-12 border border-blue-600 rounded bg-blue-700 opacity-50 pattern-grid-lg" />
            </div>
        );
    }

    return (
        <div className={`w-10 h-14 bg-white rounded border border-gray-300 shadow-md flex flex-col items-center justify-center select-none ${className}`}>
            <span className={`font-bold text-sm ${SUIT_COLORS[card.suit]}`}>{card.rank === 'T' ? '10' : card.rank}</span>
            <span className={`text-lg leading-none ${SUIT_COLORS[card.suit]}`}>{SUIT_ICONS[card.suit]}</span>
        </div>
    );
};
