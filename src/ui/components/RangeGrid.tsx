'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Range,
  RANKS,
  getHandNotation,
  getHandCategory,
  countCombos,
  generateHandMatrix,
  type HandCategory,
} from '../../core/ranges';

interface RangeGridProps {
  range: Range;
  onRangeChange: (range: Range) => void;
  weight: number; // 0-1, the weight to apply when clicking
  readOnly?: boolean;
}

interface CellProps {
  hand: string;
  category: HandCategory;
  weight: number; // Current weight in range
  onMouseDown: (hand: string) => void;
  onMouseEnter: (hand: string) => void;
  readOnly: boolean;
}

/**
 * Get background color based on weight and category
 */
function getCellStyle(weight: number, category: HandCategory): React.CSSProperties {
  // Base colors for each category (at full weight)
  const categoryColors = {
    pair: { r: 239, g: 68, b: 68 },    // Red for pairs
    suited: { r: 34, g: 197, b: 94 },   // Green for suited
    offsuit: { r: 59, g: 130, b: 246 }, // Blue for offsuit
  };

  const baseColor = categoryColors[category];

  if (weight === 0) {
    return {
      backgroundColor: '#374151', // gray-700
      color: '#9ca3af', // gray-400
    };
  }

  // Interpolate between gray and the category color based on weight
  const grayBase = { r: 55, g: 65, b: 81 }; // gray-700
  const r = Math.round(grayBase.r + (baseColor.r - grayBase.r) * weight);
  const g = Math.round(grayBase.g + (baseColor.g - grayBase.g) * weight);
  const b = Math.round(grayBase.b + (baseColor.b - grayBase.b) * weight);

  // Text color: white for high weights, darker for low
  const textColor = weight > 0.3 ? '#ffffff' : '#d1d5db';

  return {
    backgroundColor: `rgb(${r}, ${g}, ${b})`,
    color: textColor,
  };
}

/**
 * Single cell in the range grid
 */
const RangeCell = React.memo(function RangeCell({
  hand,
  category,
  weight,
  onMouseDown,
  onMouseEnter,
  readOnly,
}: CellProps) {
  const style = getCellStyle(weight, category);
  const combos = countCombos(hand);

  return (
    <div
      className={`
        relative flex flex-col items-center justify-center
        aspect-square select-none text-xs font-medium
        border border-gray-600/50 rounded-sm
        transition-colors duration-75
        ${!readOnly ? 'cursor-pointer hover:brightness-110' : ''}
      `}
      style={style}
      onMouseDown={(e) => {
        e.preventDefault();
        if (!readOnly) onMouseDown(hand);
      }}
      onMouseEnter={() => {
        if (!readOnly) onMouseEnter(hand);
      }}
      title={`${hand}: ${combos} combos (${(weight * 100).toFixed(0)}%)`}
    >
      <span className="leading-none">{hand}</span>
      {weight > 0 && weight < 1 && (
        <span className="text-[8px] opacity-75 leading-none">
          {(weight * 100).toFixed(0)}%
        </span>
      )}
    </div>
  );
});

/**
 * 13x13 Range Grid Component
 *
 * Displays a poker hand range matrix with:
 * - Pairs on the diagonal
 * - Suited hands in the top-right triangle
 * - Offsuit hands in the bottom-left triangle
 */
export function RangeGrid({
  range,
  onRangeChange,
  weight,
  readOnly = false,
}: RangeGridProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'add' | 'remove'>('add');
  const containerRef = useRef<HTMLDivElement>(null);

  const matrix = useMemo(() => generateHandMatrix(), []);

  const handleMouseDown = useCallback(
    (hand: string) => {
      if (readOnly) return;

      setIsDragging(true);

      // Determine drag mode: if cell has weight, we're removing; otherwise adding
      const currentWeight = range[hand] || 0;
      const newMode = currentWeight > 0 ? 'remove' : 'add';
      setDragMode(newMode);

      // Apply the change
      const newRange = { ...range };
      newRange[hand] = newMode === 'add' ? weight : 0;
      onRangeChange(newRange);
    },
    [range, onRangeChange, weight, readOnly]
  );

  const handleMouseEnter = useCallback(
    (hand: string) => {
      if (!isDragging || readOnly) return;

      const newRange = { ...range };
      newRange[hand] = dragMode === 'add' ? weight : 0;
      onRangeChange(newRange);
    },
    [isDragging, dragMode, range, onRangeChange, weight, readOnly]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      ref={containerRef}
      className="select-none"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Column headers */}
      <div className="grid grid-cols-[auto_repeat(13,1fr)] gap-0.5 mb-0.5">
        <div className="w-4" /> {/* Empty corner */}
        {RANKS.map((rank) => (
          <div
            key={rank}
            className="text-center text-xs text-gray-400 font-medium"
          >
            {rank}
          </div>
        ))}
      </div>

      {/* Grid rows */}
      {matrix.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className="grid grid-cols-[auto_repeat(13,1fr)] gap-0.5 mb-0.5"
        >
          {/* Row header */}
          <div className="w-4 flex items-center justify-center text-xs text-gray-400 font-medium">
            {RANKS[rowIndex]}
          </div>

          {/* Cells */}
          {row.map((cell) => (
            <RangeCell
              key={cell.hand}
              hand={cell.hand}
              category={cell.category}
              weight={range[cell.hand] || 0}
              onMouseDown={handleMouseDown}
              onMouseEnter={handleMouseEnter}
              readOnly={readOnly}
            />
          ))}
        </div>
      ))}

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-3 text-xs text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-500" />
          <span>Pairs</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-500" />
          <span>Suited</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-500" />
          <span>Offsuit</span>
        </div>
      </div>
    </div>
  );
}
