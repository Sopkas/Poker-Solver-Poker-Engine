import React from 'react';
import { GameState, Street } from '../../core/types';
import { ReplayControls } from '../hooks/usePokerEngine';

interface ReplayBarProps {
    state: GameState;
    replay: ReplayControls;
}

const getStreetLabel = (street: Street): string => {
    switch (street) {
        case 'preflop': return 'Preflop';
        case 'flop': return 'Flop';
        case 'turn': return 'Turn';
        case 'river': return 'River';
        case 'showdown': return 'Showdown';
        default: return street;
    }
};

export const ReplayBar: React.FC<ReplayBarProps> = ({ state, replay }) => {
    const {
        currentStep,
        totalSteps,
        isLive,
        goToStep,
        stepBack,
        stepForward,
        goLive,
        goToStart,
        isAutoPlaying,
        toggleAutoPlay,
    } = replay;

    // Button styles
    const btnBase = "px-3 py-2 rounded font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed";
    const btnPrimary = `${btnBase} bg-blue-600 hover:bg-blue-500 text-white`;
    const btnLive = `${btnBase} bg-green-600 hover:bg-green-500 text-white`;
    const btnPlay = `${btnBase} ${isAutoPlaying ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-purple-600 hover:bg-purple-500'} text-white`;

    return (
        <div className="bg-gray-800/95 backdrop-blur border-t border-white/10 px-4 py-2">
            <div className="flex items-center gap-4 max-w-4xl mx-auto">
                {/* Step Info */}
                <div className="flex flex-col min-w-[120px]">
                    <span className="text-xs text-gray-400">Step</span>
                    <span className="text-white font-mono">
                        {currentStep + 1} / {totalSteps}
                    </span>
                </div>

                {/* Street Info */}
                <div className="flex flex-col min-w-[80px]">
                    <span className="text-xs text-gray-400">Street</span>
                    <span className="text-white font-semibold">
                        {getStreetLabel(state.street)}
                    </span>
                </div>

                {/* VCR Controls */}
                <div className="flex items-center gap-2 flex-1 justify-center">
                    {/* Go to Start */}
                    <button
                        onClick={goToStart}
                        disabled={currentStep === 0}
                        className={btnPrimary}
                        title="Go to Start"
                    >
                        |&lt;&lt;
                    </button>

                    {/* Step Back */}
                    <button
                        onClick={stepBack}
                        disabled={currentStep === 0}
                        className={btnPrimary}
                        title="Step Back"
                    >
                        &lt;
                    </button>

                    {/* Auto-Play Toggle */}
                    <button
                        onClick={toggleAutoPlay}
                        disabled={isLive && !isAutoPlaying}
                        className={btnPlay}
                        title={isAutoPlaying ? "Pause" : "Auto-Play"}
                    >
                        {isAutoPlaying ? '||' : '\u25B6'}
                    </button>

                    {/* Step Forward */}
                    <button
                        onClick={stepForward}
                        disabled={isLive}
                        className={btnPrimary}
                        title="Step Forward"
                    >
                        &gt;
                    </button>

                    {/* Go Live */}
                    <button
                        onClick={goLive}
                        disabled={isLive}
                        className={`${btnLive} ${!isLive ? 'animate-pulse' : ''}`}
                        title="Go Live"
                    >
                        &gt;&gt;|
                    </button>
                </div>

                {/* Slider */}
                <div className="flex-1 max-w-[200px]">
                    <input
                        type="range"
                        min={0}
                        max={totalSteps - 1}
                        value={currentStep}
                        onChange={(e) => goToStep(Number(e.target.value))}
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>

                {/* Live Indicator */}
                <div className="min-w-[80px] flex justify-end">
                    {isLive ? (
                        <span className="flex items-center gap-2 text-green-400 font-bold text-sm">
                            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                            LIVE
                        </span>
                    ) : (
                        <span className="flex items-center gap-2 text-yellow-400 font-bold text-sm">
                            <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                            REPLAY
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
