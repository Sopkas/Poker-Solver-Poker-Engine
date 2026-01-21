import { GameState, Action, ActionType, Street } from '../types';
import { Engine } from '../engine';
import { Rules, isSingleSurvivor } from '../rules';
import { SolverNode, SolverEdge, TreeConfig, NodeType } from './types';

export function buildTree(initialState: GameState, config: TreeConfig): SolverNode {
    return recursiveBuild(initialState, config, 0);
}

function recursiveBuild(state: GameState, config: TreeConfig, raisesInStreet: number): SolverNode {
    const nodeId = generateNodeId(state);

    // 1. Check Termination
    if (state.street === 'showdown') {
        return {
            id: nodeId,
            state,
            type: 'showdown',
            children: [],
            pot: state.pots.reduce((sum, p) => sum + p.amount, 0),
            activePlayer: -1
        };
    }

    if (isSingleSurvivor(state)) {
        return {
            id: nodeId,
            state,
            type: 'terminal_fold',
            children: [],
            pot: state.pots.reduce((sum, p) => sum + p.amount, 0),
            activePlayer: -1
        };
    }

    const activeSeat = state.actionSeat;
    const activePlayer = state.players.find(p => p.seat === activeSeat);

    if (!activePlayer) {
        throw new Error(`No active player found at seat ${activeSeat}`);
    }

    const legalActionTypes = Rules.getLegalActions(state);
    const children: SolverEdge[] = [];

    // 2. Generate Actions

    // Fold
    if (legalActionTypes.includes('fold')) {
        children.push(createEdge(state, config, {
            type: 'fold',
            playerId: activePlayer.id,
            street: state.street,
            amount: 0,
            isAllIn: false,
            timestamp: Date.now()
        }, raisesInStreet));
    }

    // Check
    if (legalActionTypes.includes('check')) {
        children.push(createEdge(state, config, {
            type: 'check',
            playerId: activePlayer.id,
            street: state.street,
            amount: 0,
            isAllIn: false,
            timestamp: Date.now()
        }, raisesInStreet));
    }

    // Call
    if (legalActionTypes.includes('call')) {
        // Calculate call amount
        // The engine handles the amount logic, but for the Action object we need to specify it?
        // Rules.getLegalActionsDetailed would give us the amount, but let's just calculate it.
        // Call amount is (currentBet - player.bet).
        const callAmount = state.currentBet - activePlayer.bet;
        children.push(createEdge(state, config, {
            type: 'call',
            playerId: activePlayer.id,
            street: state.street,
            amount: callAmount,
            isAllIn: callAmount >= activePlayer.stack,
            timestamp: Date.now()
        }, raisesInStreet));
    }

    // Bet / Raise
    // We treat Bet and Raise similarly for sizing, but the type differs.
    const canBet = legalActionTypes.includes('bet');
    const canRaise = legalActionTypes.includes('raise');

    if ((canBet || canRaise) && raisesInStreet < config.maxRaises) {
        const actionType: ActionType = canBet ? 'bet' : 'raise';
        const potSize = state.pots.reduce((sum, p) => sum + p.amount, 0) + state.players.reduce((sum, p) => sum + p.bet, 0);

        // Get configured sizes for this street
        const sizes = config.betSizes[state.street] || [];

        for (const pct of sizes) {
            // Calculate amount
            // Bet: amount = pot * pct
            // Raise: amount = ? usually (pot + call_amount) * pct + call_amount? 
            // For simplicity in MVP: amount = pot * pct.
            // If Raise, we need to ensure we meet minRaise.

            let targetAmount = Math.floor(potSize * pct);

            // Constraints
            // 1. Min Raise/Bet
            const minRaiseAbs = state.minRaise + state.currentBet; // The target total bet amount
            // Wait, state.minRaise is the increment.
            // If currentBet is 0, minRaise is BB. Target is BB.
            // If currentBet is 100, minRaise is 50. Target is 150.

            // For 'bet', currentBet is 0. minRaise is BB.
            // For 'raise', currentBet > 0.

            // My engine uses 'amount' as the DELTA to add to the stack? 
            // Let's check scenarios.test.ts again.
            // "This implies action.amount is the AMOUNT TO ADD (chip count to move)."
            // "If B raises to 100. B has 20. B needs to add 80. So action.amount should be 80."

            // So we need to calculate the DELTA.

            // First, determine the TOTAL bet we want to reach.
            // If we bet 50% pot.
            // If pot is 100. Bet 50. Total bet 50.
            // If pot is 100. Bet 100. Raise to ?

            // Standard geometric sizing usually refers to the raise size relative to the pot.
            // Let's assume `pct` is fraction of the pot *after* the previous bet is called?
            // Or just simple % of current pot?
            // Let's stick to simple % of current pot (including current bets).

            let amountToAdd = 0;

            if (actionType === 'bet') {
                amountToAdd = targetAmount;
            } else {
                // Raise
                // Logic: We want to raise BY `targetAmount`? Or TO `targetAmount`?
                // Usually "Bet 50%" means "Add 50% of pot".
                amountToAdd = targetAmount;
            }

            // Clamp to MinRaise
            // The amount we ADD must be at least state.minRaise?
            // If I bet, min bet is BB.
            // If I raise, min raise is state.minRaise (the increment).
            // So amountToAdd >= state.minRaise.

            if (amountToAdd < state.minRaise) {
                amountToAdd = state.minRaise;
            }

            // Clamp to Stack
            if (amountToAdd > activePlayer.stack) {
                amountToAdd = activePlayer.stack;
            }

            // If we are just calling (amountToAdd == callAmount), skip?
            // But callAmount is for 'call'. 'raise' must be > callAmount?
            // Wait, if I raise, I must add at least (currentBet - myBet) + minRaise.
            // state.minRaise IS that increment?
            // Let's check `types.ts`: "minRaise: number; // The minimum raise amount valid right now"
            // If currentBet 100. I bet 0. Call is 100.
            // MinRaise increment is usually 100.
            // So I must add 100 (call) + 100 (raise) = 200?
            // Or does `state.minRaise` already account for that?
            // In `engine.ts`, `minRaise` is updated on raise.

            // Let's assume `state.minRaise` is the minimum *additional* amount on top of the call.
            // No, `state.minRaise` is usually the size of the last raise.
            // To make a legal raise, I must raise by at least `state.minRaise`.
            // So Total Bet >= Current Bet + state.minRaise.
            // My contribution >= (Current Bet - My Bet) + state.minRaise.

            // Let's look at `validation.ts` or `rules.ts` if possible, but I can't see them right now.
            // I'll assume `amountToAdd` (delta) must be >= (currentBet - myBet) + state.minRaise.
            // Wait, if I use `amountToAdd` as the argument to `applyAction`, it is the chips moving from stack to bet.

            // Let's simplify:
            // We generate a "Raise" action.
            // The amount we put in is `amountToAdd`.
            // This amount must cover the call + the raise.
            // Call part = state.currentBet - activePlayer.bet.
            // Raise part = amountToAdd - Call part.
            // Raise part must be >= state.minRaise.

            // So `amountToAdd >= (state.currentBet - activePlayer.bet) + state.minRaise`.

            const callPart = state.currentBet - activePlayer.bet;
            const minRaiseDelta = callPart + state.minRaise;

            if (amountToAdd < minRaiseDelta) {
                amountToAdd = minRaiseDelta;
            }

            // Re-clamp to stack
            if (amountToAdd > activePlayer.stack) {
                amountToAdd = activePlayer.stack;
            }

            // If after clamping, we are just calling (or less?), then it's not a raise.
            // But we already handled 'call'.
            // If amountToAdd == callPart, it's a call.
            // If amountToAdd < callPart, it's an invalid raise (but we clamped to stack, so maybe all-in call?).
            // If it's All-In, it can be less than minRaise.

            const isAllIn = amountToAdd === activePlayer.stack;

            // If not all-in and amount < minRaiseDelta, skip (invalid size).
            if (!isAllIn && amountToAdd < minRaiseDelta) {
                continue;
            }

            // If it is effectively a call (amountToAdd == callPart), skip because we have 'call' action.
            if (amountToAdd === callPart) {
                continue;
            }

            // Add action
            children.push(createEdge(state, config, {
                type: actionType,
                playerId: activePlayer.id,
                street: state.street,
                amount: amountToAdd,
                isAllIn,
                timestamp: Date.now()
            }, raisesInStreet + 1));
        }
    }

    return {
        id: nodeId,
        state,
        type: 'action',
        children,
        pot: state.pots.reduce((sum, p) => sum + p.amount, 0),
        activePlayer: activePlayer.seat
    };
}

function createEdge(state: GameState, config: TreeConfig, action: Action, raisesInStreet: number): SolverEdge {
    const nextState = Engine.applyAction(state, action);

    // Check if street changed
    const nextRaises = nextState.street !== state.street ? 0 : raisesInStreet;

    return {
        action,
        nextNode: recursiveBuild(nextState, config, nextRaises)
    };
}

function generateNodeId(state: GameState): string {
    // Simple hash for MVP. In production, use a robust hash of the canonical state.
    // We need to capture: street, pots, players (stacks, bets, status, cards), board, activeSeat.
    // JSON.stringify is slow but safe for now.
    return JSON.stringify({
        street: state.street,
        pots: state.pots,
        players: state.players.map(p => ({ id: p.id, stack: p.stack, bet: p.bet, status: p.status })),
        communityCards: state.communityCards,
        actionSeat: state.actionSeat
    });
}
