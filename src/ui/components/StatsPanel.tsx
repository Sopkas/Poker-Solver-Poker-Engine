import React from 'react';
import { GameState } from '../../core/types';
import {
  analyzeState,
  getPotOddsColor,
  getSPRZone,
  getMRatioZone,
  GameStats,
} from '../../core/analysis';

interface StatsPanelProps {
  state: GameState;
  heroSeat: number;
}

/**
 * Analyst HUD - displays real-time decision metrics for the hero.
 * Calculates pot odds, SPR, M-ratio based on the current (or replay) state.
 */
export const StatsPanel: React.FC<StatsPanelProps> = ({ state, heroSeat }) => {
  const stats: GameStats = analyzeState(state, heroSeat);
  const hero = state.players.find(p => p.seat === heroSeat);

  // Don't show panel if hero is not found or is sitting out
  if (!hero || hero.status === 'sitting-out') {
    return null;
  }

  // Color classes for pot odds
  const potOddsColorClass = stats.potOdds !== null
    ? {
        green: 'text-green-400',
        yellow: 'text-yellow-400',
        red: 'text-red-400',
      }[getPotOddsColor(stats.potOdds)]
    : 'text-gray-400';

  // Color classes for M-ratio
  const mRatioColorClass = stats.mRatio !== null
    ? {
        green: 'text-green-400',
        yellow: 'text-yellow-400',
        orange: 'text-orange-400',
        red: 'text-red-400',
      }[getMRatioZone(stats.mRatio)]
    : 'text-gray-400';

  // Only show M-ratio in danger zone (M < 10)
  const showMRatio = stats.mRatio !== null && stats.mRatio < 10;

  return (
    <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg p-3 text-white shadow-xl border border-white/10 min-w-[140px]">
      {/* Header */}
      <div className="text-xs text-white/50 uppercase tracking-widest mb-2 font-semibold border-b border-white/10 pb-1">
        Analyst HUD
      </div>

      {/* Total Pot */}
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-gray-400">Pot</span>
        <span className="text-sm font-bold text-yellow-400">
          {stats.totalPot}
        </span>
      </div>

      {/* Amount to Call */}
      {stats.amountToCall > 0 && (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-gray-400">To Call</span>
          <span className="text-sm font-bold text-white">
            {stats.amountToCall}
          </span>
        </div>
      )}

      {/* Pot Odds */}
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-gray-400">Pot Odds</span>
        <span className={`text-sm font-bold ${potOddsColorClass}`}>
          {stats.potOdds !== null
            ? `${stats.potOdds.toFixed(1)}%`
            : '—'}
        </span>
      </div>

      {/* Divider */}
      <div className="border-t border-white/10 my-2" />

      {/* SPR */}
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-gray-400">SPR</span>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-cyan-400">
            {stats.spr !== null ? stats.spr.toFixed(1) : '—'}
          </span>
          {stats.spr !== null && (
            <span className="text-xs text-gray-500">
              ({getSPRZone(stats.spr)})
            </span>
          )}
        </div>
      </div>

      {/* Effective Stack */}
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-gray-400">Eff. Stack</span>
        <span className="text-sm font-bold text-purple-400">
          {stats.effectiveStack}
        </span>
      </div>

      {/* M-Ratio (only shown in danger zone) */}
      {showMRatio && (
        <>
          <div className="border-t border-white/10 my-2" />
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">M-Ratio</span>
            <span className={`text-sm font-bold ${mRatioColorClass}`}>
              {stats.mRatio!.toFixed(1)}
            </span>
          </div>
        </>
      )}
    </div>
  );
};
