'use client';

import React, { useState, useCallback } from 'react';
import { RangeGrid } from './RangeGrid';
import { RangeControls } from './RangeControls';
import { Range, generateEmptyRange } from '../../core/ranges';

interface RangeManagerProps {
  initialRange?: Range;
  onRangeChange?: (range: Range) => void;
  title?: string;
}

/**
 * Range Manager - Complete UI for editing poker hand ranges
 *
 * Combines:
 * - 13x13 RangeGrid for visual selection
 * - RangeControls for weight slider, presets, and stats
 */
export function RangeManager({
  initialRange,
  onRangeChange,
  title = 'Range Editor',
}: RangeManagerProps) {
  const [range, setRange] = useState<Range>(initialRange || generateEmptyRange());
  const [weight, setWeight] = useState(1); // Default to 100%

  const handleRangeChange = useCallback(
    (newRange: Range) => {
      setRange(newRange);
      onRangeChange?.(newRange);
    },
    [onRangeChange]
  );

  return (
    <div className="bg-gray-900 rounded-xl p-4 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <div className="text-xs text-gray-500">
          Click to toggle, drag to paint
        </div>
      </div>

      {/* Main content - Grid and Controls side by side */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Grid */}
        <div className="flex-shrink-0">
          <RangeGrid
            range={range}
            onRangeChange={handleRangeChange}
            weight={weight}
          />
        </div>

        {/* Controls */}
        <div className="flex-grow min-w-[200px] lg:max-w-[280px]">
          <RangeControls
            range={range}
            onRangeChange={handleRangeChange}
            weight={weight}
            onWeightChange={setWeight}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Modal wrapper for RangeManager
 */
interface RangeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRange?: Range;
  onSave?: (range: Range) => void;
  title?: string;
}

export function RangeManagerModal({
  isOpen,
  onClose,
  initialRange,
  onSave,
  title = 'Edit Range',
}: RangeManagerModalProps) {
  const [currentRange, setCurrentRange] = useState<Range>(
    initialRange || generateEmptyRange()
  );

  if (!isOpen) return null;

  const handleSave = () => {
    onSave?.(currentRange);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-800 rounded-xl shadow-2xl max-w-4xl max-h-[90vh] overflow-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-white
                     rounded-lg hover:bg-gray-700 transition-colors"
          aria-label="Close"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Content */}
        <div className="p-6">
          <RangeManager
            initialRange={initialRange}
            onRangeChange={setCurrentRange}
            title={title}
          />

          {/* Action buttons */}
          {onSave && (
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-700">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-300
                           bg-gray-700 rounded-lg hover:bg-gray-600
                           transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white
                           bg-blue-600 rounded-lg hover:bg-blue-500
                           transition-colors"
              >
                Save Range
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
