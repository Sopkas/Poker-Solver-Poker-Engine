import React, { useState } from 'react';
import { ScenarioConfig, ScenarioPlayer, Card } from '../../core/types';
import { parseCards } from '../../utils/cardParser';

interface GameSetupModalProps {
    onStart: (config: ScenarioConfig) => void;
    onClose: () => void;
}

export const GameSetupModal: React.FC<GameSetupModalProps> = ({ onStart, onClose }) => {
    const [numPlayers, setNumPlayers] = useState(6);
    const [smallBlind, setSmallBlind] = useState(1);
    const [bigBlind, setBigBlind] = useState(2);
    const [startingStack, setStartingStack] = useState(200);
    const [heroSeat, setHeroSeat] = useState(0);
    const [dealerSeat, setDealerSeat] = useState(0);

    // Player specific overrides
    const [playerOverrides, setPlayerOverrides] = useState<ScenarioPlayer[]>([]);

    const handlePlayerOverrideChange = (seat: number, field: keyof ScenarioPlayer, value: any) => {
        setPlayerOverrides(prev => {
            const existing = prev.find(p => p.seat === seat) || { seat };
            const updated = { ...existing, [field]: value };

            // Remove if empty/default (optimization)
            const otherOverrides = prev.filter(p => p.seat !== seat);
            return [...otherOverrides, updated].sort((a, b) => a.seat - b.seat);
        });
    };

    const handleCardInput = (seat: number, input: string) => {
        try {
            const cards = parseCards(input);
            handlePlayerOverrideChange(seat, 'cards', cards);
        } catch (e) {
            // Invalid input, maybe clear cards or show error state
            // For now, just don't update if invalid
            if (input === '') {
                handlePlayerOverrideChange(seat, 'cards', undefined);
            }
        }
    };

    const handleStart = () => {
        const config: ScenarioConfig = {
            numPlayers,
            smallBlind,
            bigBlind,
            startingStack,
            heroSeat,
            dealerSeat,
            players: playerOverrides
        };
        onStart(config);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto text-white">
                <h2 className="text-2xl font-bold mb-4">New Game Setup</h2>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium mb-1">Players</label>
                        <input
                            type="number"
                            min="2"
                            max="9"
                            value={numPlayers}
                            onChange={(e) => setNumPlayers(parseInt(e.target.value))}
                            className="w-full bg-gray-700 rounded px-3 py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Starting Stack</label>
                        <input
                            type="number"
                            value={startingStack}
                            onChange={(e) => setStartingStack(parseInt(e.target.value))}
                            className="w-full bg-gray-700 rounded px-3 py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Small Blind</label>
                        <input
                            type="number"
                            value={smallBlind}
                            onChange={(e) => setSmallBlind(parseInt(e.target.value))}
                            className="w-full bg-gray-700 rounded px-3 py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Big Blind</label>
                        <input
                            type="number"
                            value={bigBlind}
                            onChange={(e) => setBigBlind(parseInt(e.target.value))}
                            className="w-full bg-gray-700 rounded px-3 py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Hero Seat</label>
                        <select
                            value={heroSeat}
                            onChange={(e) => setHeroSeat(parseInt(e.target.value))}
                            className="w-full bg-gray-700 rounded px-3 py-2"
                        >
                            {Array.from({ length: numPlayers }).map((_, i) => (
                                <option key={i} value={i}>Seat {i}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Dealer Seat</label>
                        <select
                            value={dealerSeat}
                            onChange={(e) => setDealerSeat(parseInt(e.target.value))}
                            className="w-full bg-gray-700 rounded px-3 py-2"
                        >
                            {Array.from({ length: numPlayers }).map((_, i) => (
                                <option key={i} value={i}>Seat {i}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <h3 className="text-xl font-semibold mb-3">Player Overrides (God Mode)</h3>
                <div className="space-y-3 mb-6">
                    {Array.from({ length: numPlayers }).map((_, i) => {
                        const override = playerOverrides.find(p => p.seat === i);
                        const cardStr = override?.cards ? override.cards.map(c => c.rank + c.suit).join('') : '';

                        return (
                            <div key={i} className="flex items-center gap-3 bg-gray-700 p-2 rounded">
                                <span className="w-16 font-medium">Seat {i}</span>
                                <input
                                    type="text"
                                    placeholder="Name"
                                    value={override?.name || ''}
                                    onChange={(e) => handlePlayerOverrideChange(i, 'name', e.target.value)}
                                    className="bg-gray-600 rounded px-2 py-1 w-24 text-sm"
                                />
                                <input
                                    type="number"
                                    placeholder="Stack"
                                    value={override?.stack || ''}
                                    onChange={(e) => handlePlayerOverrideChange(i, 'stack', parseInt(e.target.value))}
                                    className="bg-gray-600 rounded px-2 py-1 w-20 text-sm"
                                />
                                <input
                                    type="text"
                                    placeholder="Cards (e.g. AhKh)"
                                    defaultValue={cardStr}
                                    onBlur={(e) => handleCardInput(i, e.target.value)}
                                    className="bg-gray-600 rounded px-2 py-1 flex-1 text-sm uppercase"
                                />
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleStart}
                        className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 font-bold"
                    >
                        Start Simulation
                    </button>
                </div>
            </div>
        </div>
    );
};
