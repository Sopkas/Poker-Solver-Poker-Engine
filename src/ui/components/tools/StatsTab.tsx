import React from 'react';
import { GameState } from '../../../core/types';
import {
    analyzeState,
    getPotOddsColor,
    getSPRZone,
    getMRatioZone,
    GameStats,
} from '../../../core/analysis';

interface StatsTabProps {
    state: GameState;
    heroSeat: number;
}

export const StatsTab: React.FC<StatsTabProps> = ({ state, heroSeat }) => {
    const stats: GameStats = analyzeState(state, heroSeat);
    const hero = state.players.find(p => p.seat === heroSeat);

    if (!hero || hero.status === 'sitting-out') {
        return (
            <div className="p-4 text-center text-gray-500">
                Hero is sitting out.
            </div>
        );
    }

    // Color helpers
    const getPotOddsClass = (odds: number | null) => {
        if (odds === null) return 'text-gray-400';
        const color = getPotOddsColor(odds);
        return {
            green: 'text-green-400',
            yellow: 'text-yellow-400',
            red: 'text-red-400',
        }[color];
    };

    const getMRatioClass = (m: number | null) => {
        if (m === null) return 'text-gray-400';
        const zone = getMRatioZone(m);
        return {
            green: 'text-green-400',
            yellow: 'text-yellow-400',
            orange: 'text-orange-400',
            red: 'text-red-400',
        }[zone];
    };

    const StatRow = ({ label, value, subValue, valueClass = 'text-white' }: { label: string, value: React.ReactNode, subValue?: string, valueClass?: string }) => (
        <div className="flex justify-between items-center py-3 border-b border-gray-800 last:border-0">
            <span className="text-sm text-gray-400">{label}</span>
            <div className="text-right">
                <div className={`font-mono font-bold ${valueClass}`}>{value}</div>
                {subValue && <div className="text-xs text-gray-500">{subValue}</div>}
            </div>
        </div>
    );

    return (
        <div className="p-4 h-full overflow-y-auto">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Decision Metrics</h3>

            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <StatRow
                    label="Total Pot"
                    value={stats.totalPot}
                    valueClass="text-yellow-400"
                />

                {stats.amountToCall > 0 && (
                    <StatRow
                        label="To Call"
                        value={stats.amountToCall}
                    />
                )}

                <StatRow
                    label="Pot Odds"
                    value={stats.potOdds !== null ? `${stats.potOdds.toFixed(1)}%` : '—'}
                    valueClass={getPotOddsClass(stats.potOdds)}
                />

                <StatRow
                    label="SPR"
                    value={stats.spr !== null ? stats.spr.toFixed(2) : '—'}
                    subValue={stats.spr !== null ? `(${getSPRZone(stats.spr)})` : undefined}
                    valueClass="text-cyan-400"
                />

                <StatRow
                    label="Effective Stack"
                    value={stats.effectiveStack}
                    valueClass="text-purple-400"
                />

                {stats.mRatio !== null && (
                    <StatRow
                        label="M-Ratio"
                        value={stats.mRatio.toFixed(1)}
                        valueClass={getMRatioClass(stats.mRatio)}
                    />
                )}
            </div>

            <div className="mt-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Game Info</h3>
                <div className="space-y-2 text-sm text-gray-400">
                    <div className="flex justify-between">
                        <span>Street</span>
                        <span className="text-white capitalize">{state.street}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Min Raise</span>
                        <span className="text-orange-400">${state.minRaise}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Dealer Seat</span>
                        <span className="text-white">{state.dealerSeat}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
