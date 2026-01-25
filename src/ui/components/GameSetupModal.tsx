import React, { useState, useMemo } from 'react';
import { ScenarioConfig, ScenarioPlayer, Card } from '../../core/types';
import { parseCards } from '../../utils/cardParser';

interface GameSetupModalProps {
    onStart: (config: ScenarioConfig) => void;
    onClose: () => void;
}

type StartStreet = 'preflop' | 'flop' | 'turn' | 'river';

const streetLabels: Record<StartStreet, string> = {
    preflop: 'Preflop',
    flop: 'Flop',
    turn: 'Turn',
    river: 'River',
};

const requiredBoardCards: Record<StartStreet, number> = {
    preflop: 0,
    flop: 3,
    turn: 4,
    river: 5,
};

export const GameSetupModal: React.FC<GameSetupModalProps> = ({ onStart, onClose }) => {
    const [numPlayers, setNumPlayers] = useState(6);
    const [smallBlind, setSmallBlind] = useState(1);
    const [bigBlind, setBigBlind] = useState(2);
    const [startingStack, setStartingStack] = useState(200);
    const [heroSeat, setHeroSeat] = useState(0);
    const [dealerSeat, setDealerSeat] = useState(0);

    // Player specific overrides
    const [playerOverrides, setPlayerOverrides] = useState<ScenarioPlayer[]>([]);

    // Scenario Builder state
    const [startStreet, setStartStreet] = useState<StartStreet>('preflop');
    const [initialPot, setInitialPot] = useState(0);
    const [boardInput, setBoardInput] = useState('');
    const [boardCards, setBoardCards] = useState<Card[]>([]);
    const [boardError, setBoardError] = useState<string | null>(null);

    // Collect all used cards (player cards + board cards) for validation
    const usedCards = useMemo(() => {
        const cards: Card[] = [...boardCards];
        playerOverrides.forEach(p => {
            if (p.cards) {
                cards.push(...p.cards);
            }
        });
        return cards;
    }, [boardCards, playerOverrides]);

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

            // Check for duplicates with board cards or other players
            for (const card of cards) {
                const isDuplicate = usedCards.some(
                    c => c.rank === card.rank && c.suit === card.suit &&
                        // Exclude current player's cards from duplicate check
                        !playerOverrides.find(p => p.seat === seat)?.cards?.some(
                            pc => pc.rank === card.rank && pc.suit === card.suit
                        )
                );
                if (isDuplicate) {
                    return; // Don't update if duplicate
                }
            }

            handlePlayerOverrideChange(seat, 'cards', cards);
        } catch (e) {
            // Invalid input, maybe clear cards or show error state
            if (input === '') {
                handlePlayerOverrideChange(seat, 'cards', undefined);
            }
        }
    };

    const handleBoardInput = (input: string) => {
        setBoardInput(input);
        setBoardError(null);

        if (input.trim() === '') {
            setBoardCards([]);
            return;
        }

        try {
            const cards = parseCards(input);

            // Check for duplicates with player cards
            for (const card of cards) {
                const isDuplicate = playerOverrides.some(p =>
                    p.cards?.some(c => c.rank === card.rank && c.suit === card.suit)
                );
                if (isDuplicate) {
                    setBoardError(`Card ${card.rank}${card.suit} is already assigned to a player`);
                    return;
                }
            }

            setBoardCards(cards);
        } catch (e: any) {
            setBoardError(e.message || 'Invalid cards');
        }
    };

    const validateScenario = (): string | null => {
        if (startStreet !== 'preflop') {
            const required = requiredBoardCards[startStreet];
            if (boardCards.length !== required) {
                return `${streetLabels[startStreet]} requires exactly ${required} board cards, got ${boardCards.length}`;
            }
        }
        return null;
    };

    const handleStart = () => {
        const error = validateScenario();
        if (error) {
            setBoardError(error);
            return;
        }

        const config: ScenarioConfig = {
            numPlayers,
            smallBlind,
            bigBlind,
            startingStack,
            heroSeat,
            dealerSeat,
            players: playerOverrides,
        };

        // Add scenario if not preflop
        if (startStreet !== 'preflop') {
            config.scenario = {
                startStreet,
                initialPot,
                boardCards,
            };
        }

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

                {/* Scenario Builder Section */}
                <h3 className="text-xl font-semibold mb-3 text-amber-400">Scenario Builder (God Mode++)</h3>
                <div className="bg-gray-700 p-4 rounded-lg mb-6">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Start Street</label>
                            <select
                                value={startStreet}
                                onChange={(e) => setStartStreet(e.target.value as StartStreet)}
                                className="w-full bg-gray-600 rounded px-3 py-2"
                            >
                                {Object.entries(streetLabels).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>
                        {startStreet !== 'preflop' && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Initial Pot (Dead Money)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={initialPot}
                                    onChange={(e) => setInitialPot(parseInt(e.target.value) || 0)}
                                    className="w-full bg-gray-600 rounded px-3 py-2"
                                />
                            </div>
                        )}
                    </div>

                    {startStreet !== 'preflop' && (
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Board Cards ({boardCards.length}/{requiredBoardCards[startStreet]} required)
                            </label>
                            <input
                                type="text"
                                placeholder={`e.g. ${startStreet === 'flop' ? 'AhKhQh' : startStreet === 'turn' ? 'AhKhQhJh' : 'AhKhQhJhTh'}`}
                                value={boardInput}
                                onChange={(e) => handleBoardInput(e.target.value.toUpperCase())}
                                className={`w-full bg-gray-600 rounded px-3 py-2 uppercase ${boardError ? 'border-2 border-red-500' : ''}`}
                            />
                            {boardError && (
                                <p className="text-red-400 text-sm mt-1">{boardError}</p>
                            )}
                            {boardCards.length > 0 && !boardError && (
                                <p className="text-green-400 text-sm mt-1">
                                    ✓ {boardCards.map(c => c.rank + c.suit).join(' ')}
                                </p>
                            )}
                        </div>
                    )}
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
