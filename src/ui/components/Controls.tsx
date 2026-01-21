import React from 'react';
import { GameState, ActionType } from '../../core/types';
import { Rules } from '../../core/rules';

interface ControlsProps {
    state: GameState;
    onDispatch: (type: ActionType, amount?: number) => void;
    heroSeat: number;
    /** Whether viewing the live (latest) state - enables Ghost Mode when false */
    isLive?: boolean;
    /** Callback to go to live state */
    onGoLive?: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
    state,
    onDispatch,
    heroSeat,
    isLive = true,
    onGoLive
}) => {
    // Use find by seat number, not array index (actionSeat is a seat number, not index)
    const activePlayer = state.players.find(p => p.seat === state.actionSeat);
    const isHeroTurn = activePlayer?.seat === heroSeat;

    // Get legal actions
    const legalActions = isHeroTurn ? Rules.getLegalActionsDetailed(state) : [];

    // --- Ghost Mode: Viewing past state ---
    if (!isLive) {
        return (
            <div className="h-20 flex items-center justify-center bg-gray-900/80 backdrop-blur border-t border-white/10">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></span>
                        <span className="text-yellow-400 font-bold">REPLAY MODE</span>
                    </div>
                    <span className="text-white/50">|</span>
                    <span className="text-white/70 italic">Go Live to continue playing</span>
                    {onGoLive && (
                        <button
                            onClick={onGoLive}
                            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow-lg active:transform active:scale-95 transition-all animate-pulse"
                        >
                            GO LIVE
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // --- Showdown: Show Next Hand button ---
    if (state.street === 'showdown') {
        return (
            <div className="flex gap-4 items-center justify-center p-4 bg-gray-900/80 backdrop-blur border-t border-white/10">
                <button
                    onClick={() => onDispatch('next-hand')}
                    className="px-8 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded shadow-lg active:transform active:scale-95 transition-all text-lg animate-pulse"
                >
                    NEXT HAND
                </button>
            </div>
        );
    }

    // --- Waiting for opponent ---
    if (!isHeroTurn) {
        return (
            <div className="h-20 flex items-center justify-center text-white/50 italic bg-gray-900/80 backdrop-blur border-t border-white/10">
                Waiting for {activePlayer?.name}...
            </div>
        );
    }

    // --- Hero's turn: Show action buttons ---
    return (
        <div className="flex gap-4 items-center justify-center p-4 bg-gray-900/80 backdrop-blur border-t border-white/10">
            {legalActions.map((action) => {
                let label = action.type.toUpperCase();
                let onClick = () => onDispatch(action.type, action.minAmount);

                if (action.type === 'call') {
                    label = `CALL ${action.minAmount}`;
                } else if (action.type === 'bet' || action.type === 'raise') {
                    return null; // Handle bet/raise separately with slider
                }

                let colorClass = 'bg-blue-600 hover:bg-blue-500'; // Default (Fold)
                if (action.type === 'call' || action.type === 'check') {
                    colorClass = 'bg-green-600 hover:bg-green-500';
                }

                return (
                    <button
                        key={action.type}
                        onClick={onClick}
                        className={`px-6 py-3 ${colorClass} text-white font-bold rounded shadow-lg active:transform active:scale-95 transition-all`}
                    >
                        {label}
                    </button>
                );
            })}

            {/* Bet/Raise Controls */}
            {legalActions.some(a => a.type === 'bet' || a.type === 'raise') && (
                <BettingControls
                    legalActions={legalActions}
                    onDispatch={onDispatch}
                />
            )}
        </div>
    );
};

const BettingControls: React.FC<{
    legalActions: ReturnType<typeof Rules.getLegalActionsDetailed>,
    onDispatch: (type: ActionType, amount: number) => void
}> = ({ legalActions, onDispatch }) => {
    const betAction = legalActions.find(a => a.type === 'bet');
    const raiseAction = legalActions.find(a => a.type === 'raise');
    const action = betAction || raiseAction;

    const [amount, setAmount] = React.useState(action?.minAmount || 0);

    React.useEffect(() => {
        if (action) setAmount(action.minAmount);
    }, [action?.minAmount]);

    if (!action) return null;

    return (
        <div className="flex items-center gap-4 bg-black/40 p-2 rounded-lg">
            <div className="flex flex-col">
                <input
                    type="range"
                    min={action.minAmount}
                    max={action.maxAmount}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-48"
                />
                <div className="flex justify-between text-xs text-gray-400">
                    <span>{action.minAmount}</span>
                    <span>{action.maxAmount}</span>
                </div>
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-white font-mono text-center">{amount}</span>
                <button
                    onClick={() => onDispatch(action.type, amount)}
                    className="px-4 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-sm"
                >
                    {action.type.toUpperCase()}
                </button>
                <button
                    onClick={() => onDispatch(action.type, action.maxAmount)}
                    className="px-4 py-1 bg-[#800020] hover:bg-[#600018] text-white font-bold rounded text-sm"
                >
                    ALL IN
                </button>
            </div>
        </div>
    );
};
