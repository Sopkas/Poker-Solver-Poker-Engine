'use client';

import React from 'react';
import {
  Range,
  RangeStats,
  calculateRangeStats,
  generateEmptyRange,
  generateFullRange,
  generateTopPercentRange,
  TOTAL_COMBOS,
} from '../../core/ranges';

interface RangeControlsProps {
  range: Range;
  onRangeChange: (range: Range) => void;
  weight: number;
  onWeightChange: (weight: number) => void;
}

/**
 * Controls for the Range Manager
 *
 * Includes:
 * - Weight slider (0-100%)
 * - Preset buttons (Clear, 100%, Top X%)
 * - Statistics display
 */
export function RangeControls({
  range,
  onRangeChange,
  weight,
  onWeightChange,
}: RangeControlsProps) {
  const stats = calculateRangeStats(range);

  const presets = [
    { label: 'Clear', action: () => onRangeChange(generateEmptyRange()) },
    { label: '100%', action: () => onRangeChange(generateFullRange()) },
    { label: 'Top 5%', action: () => onRangeChange(generateTopPercentRange(5)) },
    { label: 'Top 10%', action: () => onRangeChange(generateTopPercentRange(10)) },
    { label: 'Top 20%', action: () => onRangeChange(generateTopPercentRange(20)) },
    { label: 'Top 30%', action: () => onRangeChange(generateTopPercentRange(30)) },
  ];

  return (
    <div className="space-y-4">
      {/* Weight Slider */}
      <div className="space-y-2">
        <label className="flex items-center justify-between text-sm text-gray-300">
          <span>Brush Weight</span>
          <span className="font-mono text-blue-400">{Math.round(weight * 100)}%</span>
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(weight * 100)}
          onChange={(e) => onWeightChange(Number(e.target.value) / 100)}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:w-4
                     [&::-webkit-slider-thumb]:h-4
                     [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-blue-500
                     [&::-webkit-slider-thumb]:cursor-pointer
                     [&::-webkit-slider-thumb]:hover:bg-blue-400
                     [&::-moz-range-thumb]:w-4
                     [&::-moz-range-thumb]:h-4
                     [&::-moz-range-thumb]:rounded-full
                     [&::-moz-range-thumb]:bg-blue-500
                     [&::-moz-range-thumb]:border-0
                     [&::-moz-range-thumb]:cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Preset Buttons */}
      <div className="space-y-2">
        <label className="text-sm text-gray-300">Presets</label>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={preset.action}
              className="px-3 py-1.5 text-xs font-medium rounded-md
                         bg-gray-700 text-gray-200
                         hover:bg-gray-600 active:bg-gray-500
                         transition-colors duration-100"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Statistics */}
      <div className="space-y-2">
        <label className="text-sm text-gray-300">Statistics</label>
        <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
          <StatRow
            label="Combos Selected"
            value={`${stats.totalCombos.toFixed(1)} / ${TOTAL_COMBOS}`}
          />
          <StatRow
            label="Percentage"
            value={`${stats.totalPercentage.toFixed(2)}%`}
            highlight
          />
          <StatRow
            label="Hands in Range"
            value={`${stats.handsSelected} / 169`}
          />

          {/* Visual percentage bar */}
          <div className="mt-2">
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-200"
                style={{ width: `${Math.min(stats.totalPercentage, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatRowProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function StatRow({ label, value, highlight }: StatRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      <span
        className={`font-mono text-sm ${
          highlight ? 'text-green-400 font-semibold' : 'text-gray-200'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
