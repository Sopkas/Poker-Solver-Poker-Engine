import React, { useState, useEffect, useMemo } from 'react';
import { generateRangeGrid, HandCell } from '../../../utils/range';
import { useSelection } from '../../../contexts/SelectionContext';
import {
    StrategyGrid,
    GridStrategy,
    strategyToActionGradient,
    formatStrategy,
    getAggressiveness,
    getActionColor,
    DEFAULT_ACTION_COLORS,
} from '../../../utils/solverMapping';
import { ActionStrategy } from '../../hooks/useSolver';

// ============================================================================
// TYPES
// ============================================================================

interface RangeMatrixProps {
    /** Strategy data from solver (enables strategy mode) */
    strategyData?: StrategyGrid;
    /** Current mode */
    mode?: 'edit' | 'strategy';
}

// ============================================================================
// COMPONENT
// ============================================================================

export const RangeMatrix: React.FC<RangeMatrixProps> = ({
    strategyData,
    mode = strategyData ? 'strategy' : 'edit',
}) => {
    const { selectedSeat } = useSelection();
    const [weights, setWeights] = useState<Record<string, number>>({});
    const [sliderWeight, setSliderWeight] = useState(0.5);
    const [hoveredCell, setHoveredCell] = useState<HandCell | null>(null);
    const [hoveredStrategy, setHoveredStrategy] = useState<GridStrategy | null>(null);

    const grid = useMemo(() => generateRangeGrid(), []);

    // Reset or load range when seat changes
    useEffect(() => {
        if (selectedSeat !== null) {
            setWeights({});
        }
    }, [selectedSeat]);

    const handleCellClick = (hand: string, e: React.MouseEvent) => {
        if (mode === 'strategy') return; // No editing in strategy mode

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

    // Stats Calculation (edit mode)
    const editStats = useMemo(() => {
        let totalCombos = 0;
        let selectedCombos = 0;

        grid.flat().forEach(cell => {
            const weight = weights[cell.hand] || 0;
            totalCombos += cell.combos;
            selectedCombos += cell.combos * weight;
        });

        return {
            selectedCombos,
            percentage: (selectedCombos / 1326) * 100
        };
    }, [weights, grid]);

    // No selection prompt (edit mode only)
    if (mode === 'edit' && selectedSeat === null) {
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
            {/* Header */}
            <div className="p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-sm text-gray-300 uppercase tracking-wider">
                        {mode === 'strategy' ? 'GTO Strategy' : 'Range Manager'}
                    </h3>
                    {mode === 'edit' && selectedSeat !== null && (
                        <span className="text-xs font-mono bg-gray-800 px-2 py-1 rounded text-blue-400">
                            Seat {selectedSeat}
                        </span>
                    )}
                </div>

                {/* Weight Slider (edit mode only) */}
                {mode === 'edit' && (
                    <>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-mono w-10 text-right text-gray-400">
                                {(sliderWeight * 100).toFixed(0)}%
                            </span>
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
                    </>
                )}

                {/* Strategy Legend (strategy mode only) */}
                {mode === 'strategy' && strategyData && (
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: DEFAULT_ACTION_COLORS.fold }} />
                            <span className="text-[10px] text-gray-400">Fold</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: DEFAULT_ACTION_COLORS.check }} />
                            <span className="text-[10px] text-gray-400">Check</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: DEFAULT_ACTION_COLORS.call }} />
                            <span className="text-[10px] text-gray-400">Call</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: DEFAULT_ACTION_COLORS.bet }} />
                            <span className="text-[10px] text-gray-400">Bet</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: DEFAULT_ACTION_COLORS.raise }} />
                            <span className="text-[10px] text-gray-400">Raise</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Grid */}
            <div className="flex-1 p-4 overflow-y-auto flex items-start justify-center">
                <div
                    className="grid gap-[1px] bg-gray-800 border border-gray-800 w-full aspect-square shadow-2xl"
                    style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
                >
                    {mode === 'strategy' && strategyData
                        ? renderStrategyGrid(strategyData, setHoveredStrategy)
                        : renderEditGrid(grid, weights, handleCellClick, setHoveredCell)}
                </div>
            </div>

            {/* Footer / Stats */}
            <div className="p-4 border-t border-gray-800 bg-gray-900">
                {mode === 'strategy' && strategyData ? (
                    <StrategyFooter
                        strategyData={strategyData}
                        hoveredStrategy={hoveredStrategy}
                    />
                ) : (
                    <EditFooter
                        stats={editStats}
                        hoveredCell={hoveredCell}
                    />
                )}
            </div>
        </div>
    );
};

// ============================================================================
// GRID RENDERERS
// ============================================================================

function renderStrategyGrid(
    strategyData: StrategyGrid,
    setHovered: (s: GridStrategy | null) => void
) {
    return strategyData.grid.map((row, i) =>
        row.map((cell, j) => {
            const { strategy, hand } = cell;
            const aggressiveness = getAggressiveness(strategy);
            const gradient = strategyToActionGradient(strategy);

            return (
                <div
                    key={hand}
                    className="relative flex items-center justify-center text-[10px] sm:text-[11px] lg:text-[12px] cursor-pointer hover:ring-2 hover:ring-white hover:z-20 transition-all"
                    onMouseEnter={() => setHovered(cell)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ background: gradient }}
                >
                    <span
                        className="relative z-10 font-mono font-bold drop-shadow-lg"
                        style={{
                            color: aggressiveness > 0.5 ? '#fff' : '#000',
                            textShadow: aggressiveness > 0.5 ? '0 1px 2px rgba(0,0,0,0.5)' : '0 1px 1px rgba(255,255,255,0.3)',
                        }}
                    >
                        {hand}
                    </span>
                </div>
            );
        })
    );
}

function renderEditGrid(
    grid: HandCell[][],
    weights: Record<string, number>,
    handleClick: (hand: string, e: React.MouseEvent) => void,
    setHovered: (c: HandCell | null) => void
) {
    return grid.map((row, i) =>
        row.map((cell, j) => {
            const weight = weights[cell.hand] || 0;
            let baseColor = 'bg-gray-700';
            if (cell.type === 'pair') baseColor = 'bg-green-500';
            else if (cell.type === 'suited') baseColor = 'bg-cyan-500';
            else baseColor = 'bg-rose-500';

            return (
                <div
                    key={cell.hand}
                    className="relative flex items-center justify-center text-[10px] sm:text-[11px] lg:text-[12px] cursor-pointer hover:ring-1 hover:ring-white z-10 transition-colors"
                    onMouseDown={(e) => handleClick(cell.hand, e)}
                    onContextMenu={(e) => e.preventDefault()}
                    onMouseEnter={() => setHovered(cell)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                        backgroundColor: weight > 0 ? undefined : '#111827',
                    }}
                >
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
    );
}

// ============================================================================
// FOOTER COMPONENTS
// ============================================================================

interface StrategyFooterProps {
    strategyData: StrategyGrid;
    hoveredStrategy: GridStrategy | null;
}

function StrategyFooter({ strategyData, hoveredStrategy }: StrategyFooterProps) {
    const { stats } = strategyData;

    return (
        <div className="flex justify-between items-end">
            <div>
                <div className="text-xs text-gray-500 mb-1">Aggregate Strategy</div>
                <div className="flex gap-3 text-xs">
                    {stats.avgBet > 0.01 && (
                        <span className="text-red-400">
                            Bet {(stats.avgBet * 100).toFixed(0)}%
                        </span>
                    )}
                    {stats.avgCheck > 0.01 && (
                        <span className="text-green-400">
                            Check {(stats.avgCheck * 100).toFixed(0)}%
                        </span>
                    )}
                    {stats.avgCall > 0.01 && (
                        <span className="text-blue-400">
                            Call {(stats.avgCall * 100).toFixed(0)}%
                        </span>
                    )}
                    {stats.avgFold > 0.01 && (
                        <span className="text-gray-400">
                            Fold {(stats.avgFold * 100).toFixed(0)}%
                        </span>
                    )}
                </div>
            </div>

            {hoveredStrategy && (
                <div className="text-right max-w-[180px]">
                    <div className="text-xs text-gray-500 mb-1">{hoveredStrategy.hand}</div>
                    <div className="text-xs leading-relaxed">
                        {formatStrategyCompact(hoveredStrategy.strategy)}
                    </div>
                </div>
            )}
        </div>
    );
}

interface EditFooterProps {
    stats: { selectedCombos: number; percentage: number };
    hoveredCell: HandCell | null;
}

function EditFooter({ stats, hoveredCell }: EditFooterProps) {
    return (
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
    );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatStrategyCompact(strategy: ActionStrategy): React.ReactNode {
    const parts: React.ReactNode[] = [];

    if (strategy.bet && strategy.bet > 0.01) {
        parts.push(
            <span key="bet" className="text-red-400">
                Bet {(strategy.bet * 100).toFixed(0)}%
            </span>
        );
    }
    if (strategy.raise && strategy.raise > 0.01) {
        parts.push(
            <span key="raise" className="text-orange-400">
                Raise {(strategy.raise * 100).toFixed(0)}%
            </span>
        );
    }
    if (strategy.check && strategy.check > 0.01) {
        parts.push(
            <span key="check" className="text-green-400">
                Check {(strategy.check * 100).toFixed(0)}%
            </span>
        );
    }
    if (strategy.call && strategy.call > 0.01) {
        parts.push(
            <span key="call" className="text-blue-400">
                Call {(strategy.call * 100).toFixed(0)}%
            </span>
        );
    }
    if (strategy.fold && strategy.fold > 0.01) {
        parts.push(
            <span key="fold" className="text-gray-400">
                Fold {(strategy.fold * 100).toFixed(0)}%
            </span>
        );
    }

    if (parts.length === 0) {
        return <span className="text-gray-500">No data</span>;
    }

    return (
        <div className="flex flex-col gap-0.5">
            {parts.map((part, i) => (
                <div key={i}>{part}</div>
            ))}
        </div>
    );
}
