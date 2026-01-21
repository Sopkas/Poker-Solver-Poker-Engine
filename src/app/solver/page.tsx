'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { RangeManager } from '@/ui/components/RangeManager';
import { Range, generateEmptyRange } from '@/core/ranges';

type Tab = 'range-editor' | 'equity-calculator' | 'hand-history';

export default function SolverToolsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('range-editor');
  const [playerRange, setPlayerRange] = useState<Range>(generateEmptyRange());
  const [villainRange, setVillainRange] = useState<Range>(generateEmptyRange());

  const tabs: { id: Tab; label: string; available: boolean }[] = [
    { id: 'range-editor', label: 'Range Editor', available: true },
    { id: 'equity-calculator', label: 'Equity Calculator', available: false },
    { id: 'hand-history', label: 'Hand History', available: false },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-gray-400 hover:text-white transition-colors"
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
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </Link>
              <h1 className="text-xl font-bold">Solver Tools</h1>
            </div>
            <div className="text-xs text-gray-500">
              Poker Solver Analytics Suite
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-gray-900/50 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => tab.available && setActiveTab(tab.id)}
                disabled={!tab.available}
                className={`
                  px-4 py-3 text-sm font-medium transition-colors relative
                  ${tab.available ? 'cursor-pointer' : 'cursor-not-allowed'}
                  ${
                    activeTab === tab.id
                      ? 'text-blue-400'
                      : tab.available
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-600'
                  }
                `}
              >
                {tab.label}
                {!tab.available && (
                  <span className="ml-1 text-[10px] text-gray-600">(Soon)</span>
                )}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'range-editor' && (
          <div className="space-y-6">
            {/* Instructions */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <h2 className="text-sm font-semibold text-gray-200 mb-2">
                How to Use the Range Editor
              </h2>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li>Click on any cell to toggle it on/off</li>
                <li>Click and drag to paint multiple cells</li>
                <li>Adjust the brush weight slider before clicking to set partial frequencies</li>
                <li>Use presets to quickly set common ranges</li>
              </ul>
            </div>

            {/* Two Range Editors side by side */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <RangeManager
                title="Hero Range"
                initialRange={playerRange}
                onRangeChange={setPlayerRange}
              />
              <RangeManager
                title="Villain Range"
                initialRange={villainRange}
                onRangeChange={setVillainRange}
              />
            </div>

            {/* Placeholder for future equity display */}
            <div className="bg-gray-800/30 rounded-lg p-6 border border-dashed border-gray-700 text-center">
              <p className="text-gray-500 text-sm">
                Equity Calculator coming soon. Define ranges above to analyze hand matchups.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'equity-calculator' && (
          <div className="bg-gray-800/30 rounded-lg p-12 border border-dashed border-gray-700 text-center">
            <p className="text-gray-500">
              Equity Calculator - Coming Soon
            </p>
          </div>
        )}

        {activeTab === 'hand-history' && (
          <div className="bg-gray-800/30 rounded-lg p-12 border border-dashed border-gray-700 text-center">
            <p className="text-gray-500">
              Hand History Analyzer - Coming Soon
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
