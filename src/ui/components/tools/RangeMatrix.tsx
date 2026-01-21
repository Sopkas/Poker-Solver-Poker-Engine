import React, { useState, useEffect, useMemo } from 'react';
import { generateRangeGrid, HandCell } from '../../../utils/range';
import { useSelection } from '../../../contexts/SelectionContext';

export const RangeMatrix: React.FC = () => {
    const { selectedSeat } = useSelection();
    const [weights, setWeights] = useState<Record<string, number>>({});
    const [sliderWeight, setSliderWeight] = useState(0.5);
    const [hoveredCell, setHoveredCell] = useState<HandCell | null>(null);

    const grid = useMemo(() => generateRangeGrid(), []);

    // Reset or load range when seat changes
    useEffect(() => {
        if (selectedSeat !== null) {
            setWeights({});
        }
    }, [selectedSeat]);

    const handleCellClick = (hand: string, e: React.MouseEvent) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            setWeights(prev => ({ ...prev, [hand]: sliderWeight }));
        } else {
            setWeights(prev => {
                const current = prev[hand] || 0;
                return { ...prev, [hand]: current > 0 ? 0 : 1 };
            });
        }
    };

    // Stats Calculation
    const stats = useMemo(() => {
        let totalCombos = 0;
        let selectedCombos = 0;

        grid.flat().forEach(cell => {
            const weight = weights[cell.hand] || 0;
            totalCombos += cell.combos; // Total possible combos in deck (1326)
            selectedCombos += cell.combos * weight;
        });

        return {
            selectedCombos,
            percentage: (selectedCombos / 1326) * 100
        };
    }, [weights, grid]);

    if (selectedSeat === null) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center">
                <div className="text-4xl mb-4">♠️</div>
                <h3 className="text-lg font-bold text-gray-300 mb-2">No Player Selected</h3>
                <p className="text-sm">Click on a player seat at the table to analyze their range.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-900 text-white select-none">
            {/* Header / Slider */}
            <div className="p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-sm text-gray-300 uppercase tracking-wider">Range Manager</h3>
                    <span className="text-xs font-mono bg-gray-800 px-2 py-1 rounded text-blue-400">Seat {selectedSeat}</span>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-xs font-mono w-10 text-right text-gray-400">{(sliderWeight * 100).toFixed(0)}%</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={sliderWeight}
                        onChange={(e) => setSliderWeight(parseFloat(e.target.value))}
                        className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>
                <div className="flex justify-between text-[10px] text-gray-600 mt-1 px-1">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 p-4 overflow-y-auto flex items-start justify-center">
                <div
                    className="grid gap-[1px] bg-gray-800 border border-gray-800 w-full aspect-square shadow-2xl"
                    style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
                >
                    {grid.map((row, i) =>
                        row.map((cell, j) => {
                            const weight = weights[cell.hand] || 0;
                            let baseColor = 'bg-gray-700';
                            if (cell.type === 'pair') baseColor = 'bg-green-500';
                            else if (cell.type === 'suited') baseColor = 'bg-cyan-500';
                            else baseColor = 'bg-rose-500';

                            return (
                                <div
                                    key={cell.hand}
                                    className={`relative flex items-center justify-center text-[10px] sm:text-[11px] lg:text-[12px] cursor-pointer hover:ring-1 hover:ring-white z-10 transition-colors`}
                                    onMouseDown={(e) => handleCellClick(cell.hand, e)}
                                    onContextMenu={(e) => e.preventDefault()}
                                    onMouseEnter={() => setHoveredCell(cell)}
                                    onMouseLeave={() => setHoveredCell(null)}
                                    style={{
                                        backgroundColor: weight > 0 ? undefined : '#111827', // gray-900
                                    }}
                                >
                                    {/* Background with opacity */}
                                    {weight > 0 && (
                                        <div
                                            className={`absolute inset-0 ${baseColor}`}
                                            style={{ opacity: weight }}
                                        />
                                    )}
                                    <span className={`relative z-10 font-mono ${weight > 0.5 ? 'text-black font-bold' : 'text-gray-500'}`}>
                                        {cell.hand}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Footer / Stats */}
            <div className="p-4 border-t border-gray-800 bg-gray-900">
                <div className="flex justify-between items-end">
                    <div>
                        <div className="text-xs text-gray-500 mb-1">Selected Range</div>
                        <div className="text-2xl font-bold text-white leading-none">
                            {stats.percentage.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                            {stats.selectedCombos.toFixed(1)} combos
                        </div>
                    </div>
                    {hoveredCell && (
                        <div className="text-right">
                            <div className="text-xs text-gray-500 mb-1">{hoveredCell.hand}</div>
                            <div className="text-sm font-bold text-yellow-400">
                                {hoveredCell.combos} combos
                            </div>
                            <div className="text-xs text-gray-600">
                                {hoveredCell.type}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
