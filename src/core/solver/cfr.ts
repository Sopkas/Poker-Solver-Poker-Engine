import { Card, GameState } from '../types';
import { CFRNode, CFRAction, CFRConfig, CFRResult } from './types';
import { InfosetStore, regretMatch, getAverageStrategy } from './InfosetStore';
import { evaluate } from '../evaluator';

/**
 * Vanilla CFR (Counterfactual Regret Minimization) Solver
 *
 * Designed for Heads-Up River Subgames (2 players, fixed board).
 *
 * Key concepts:
 * - Traverses game tree recursively
 * - Maintains regret and strategy sums in InfosetStore
 * - Uses regret matching to compute current strategy
 * - Converges to Nash Equilibrium over iterations
 */

/**
 * Main CFR traversal function.
 *
 * Uses the standard CFR formulation where:
 * - All utilities are from Player 0's perspective
 * - Regrets for P1 are negated (since P1's utility = -P0's utility)
 *
 * @param node Current node in the game tree
 * @param p0 Player 0's reaching probability (product of P0's strategy probs)
 * @param p1 Player 1's reaching probability (product of P1's strategy probs)
 * @param cards0 Player 0's hole cards
 * @param cards1 Player 1's hole cards
 * @param board Community cards
 * @param store InfosetStore for regrets/strategy
 * @returns Expected utility for Player 0 at this node
 */
export function cfr(
    node: CFRNode,
    p0: number,
    p1: number,
    cards0: Card[],
    cards1: Card[],
    board: Card[],
    store: InfosetStore
): number {
    // Terminal node: return payoff (always from P0's perspective)
    if (node.isTerminal) {
        return node.payoff!;
    }

    const player = node.playerToAct;
    const numActions = node.actions.length;

    // Get this player's cards for infoset key
    const heroCards = player === 0 ? cards0 : cards1;

    // Generate infoset key and get data
    const key = store.generateKey(node.id, heroCards, board);
    const data = store.get(key, numActions);

    // Get current strategy via regret matching
    const regrets = InfosetStore.getRegrets(data, numActions);
    const strategySums = InfosetStore.getStrategySums(data, numActions);

    // Allocate arrays for this call (can't share due to recursion)
    const strategy = new Float64Array(numActions);
    regretMatch(regrets, strategy);

    // Calculate utility for each action (all from P0's perspective)
    const actionUtils = new Float64Array(numActions);
    let nodeUtil = 0;

    for (let i = 0; i < numActions; i++) {
        // Recurse with updated reaching probabilities
        // NO sign flip here - all utilities are from P0's perspective
        if (player === 0) {
            actionUtils[i] = cfr(
                node.children[i],
                p0 * strategy[i],
                p1,
                cards0,
                cards1,
                board,
                store
            );
        } else {
            actionUtils[i] = cfr(
                node.children[i],
                p0,
                p1 * strategy[i],
                cards0,
                cards1,
                board,
                store
            );
        }

        nodeUtil += strategy[i] * actionUtils[i];
    }

    // Update regrets and strategy sums
    // Key insight: regrets must be from CURRENT PLAYER's perspective
    // P0's utility = actionUtils (already P0's perspective)
    // P1's utility = -actionUtils (zero-sum game)
    const opponentProb = player === 0 ? p1 : p0;
    const reachProb = player === 0 ? p0 : p1;

    for (let i = 0; i < numActions; i++) {
        // Regret = (action utility - node utility) * opponent's reaching probability
        // For P1, negate because P1's utility = -P0's utility
        const regretMultiplier = player === 0 ? 1 : -1;
        regrets[i] += regretMultiplier * (actionUtils[i] - nodeUtil) * opponentProb;

        // Accumulate strategy weighted by reaching probability
        strategySums[i] += strategy[i] * reachProb;
    }

    return nodeUtil;
}

/**
 * Run CFR for multiple iterations.
 *
 * @param root Root node of the game tree
 * @param hands Array of hand matchups to iterate over
 * @param board Community cards
 * @param iterations Number of iterations to run
 * @param store InfosetStore (optional, will create if not provided)
 * @returns CFRResult with stats
 */
export function runCFR(
    root: CFRNode,
    hands: Array<{ cards0: Card[]; cards1: Card[]; weight?: number }>,
    board: Card[],
    iterations: number,
    store?: InfosetStore
): CFRResult {
    const infosetStore = store ?? new InfosetStore();
    const startTime = Date.now();

    let totalUtil = 0;

    for (let iter = 0; iter < iterations; iter++) {
        // Iterate over all hand combinations
        for (const hand of hands) {
            const weight = hand.weight ?? 1;

            // Run CFR from root with initial reaching probabilities of 1
            const util = cfr(
                root,
                weight,
                weight,
                hand.cards0,
                hand.cards1,
                board,
                infosetStore
            );

            totalUtil += util * weight;
        }
    }

    const timeMs = Date.now() - startTime;

    return {
        iterations,
        infosetCount: infosetStore.size,
        rootEV: totalUtil / (iterations * hands.length),
        timeMs
    };
}

/**
 * Build a simple CFR tree for HU river spot.
 *
 * Supports: check, bet, call, fold, raise
 * Assumes P0 is OOP (acts first), P1 is IP.
 *
 * @param spot River spot configuration
 * @param betSizes Bet sizes as fractions of pot
 * @param maxRaises Maximum number of raises allowed
 */
export function buildRiverTree(
    gameState: GameState,
    betSizes: number[],
    maxRaises: number
): CFRNode {
    let nodeId = 0;

    // 1. Identify Players
    // In HU, dealer is SB (small blind), other is BB (big blind).
    // Dealer acts first on Flop/Turn/River (IP).
    // Non-Dealer acts last (OOP).
    // WAIT: In HU, SB is Dealer. SB acts FIRST preflop? No, SB acts first preflop?
    // Standard HU: SB is Dealer. SB posts 0.5 BB. BB posts 1 BB.
    // Preflop: SB acts first.
    // Postflop: BB acts first (OOP), SB acts last (IP).

    // Let's stick to the solver's convention:
    // Player 0 = OOP (acts first on river)
    // Player 1 = IP (acts last on river)

    // In GameState:
    // dealerSeat is the button/SB.
    // The other player is BB.
    // Postflop, BB acts first. So BB is OOP (Player 0). SB is IP (Player 1).

    const dealerSeat = gameState.dealerSeat;
    const players = gameState.players;

    // Find active players (should be 2 for HU solver)
    const activePlayers = players.filter(p => p.status !== 'folded' && p.status !== 'sitting-out');
    if (activePlayers.length !== 2) {
        throw new Error("Solver only supports Heads-Up (2 active players)");
    }

    // Identify IP and OOP
    const ipPlayer = activePlayers.find(p => p.seat === dealerSeat);
    const oopPlayer = activePlayers.find(p => p.seat !== dealerSeat);

    if (!ipPlayer || !oopPlayer) {
        // Fallback if dealerSeat isn't one of the active players (shouldn't happen in valid HU state)
        // Just take first as OOP, second as IP
        throw new Error("Could not identify IP/OOP players based on dealerSeat");
    }

    // Map to Solver Players
    // Player 0: OOP
    // Player 1: IP

    // Get current bets to calculate facing bet
    // gameState.players has 'bet' field which is the amount put in THIS street
    const bet0 = oopPlayer.bet; // OOP's current bet
    const bet1 = ipPlayer.bet;  // IP's current bet

    // Calculate facing bet
    // If bet1 > bet0, OOP is facing (bet1 - bet0)
    // If bet0 > bet1, IP is facing (bet0 - bet1)
    // But we need to know who is to act.

    const actionSeat = gameState.actionSeat;
    let playerToAct = -1; // 0 or 1

    if (actionSeat === oopPlayer.seat) {
        playerToAct = 0;
    } else if (actionSeat === ipPlayer.seat) {
        playerToAct = 1;
    } else {
        // Should not happen if game is active
        throw new Error("Action seat does not match any active player");
    }

    const currentFacingBet = Math.abs(bet0 - bet1);

    // Initial Pot for the tree
    // The 'pot' in createNode should be the Total Pot including current bets?
    // The createNode logic adds bets to the pot as it traverses.
    // So the initial pot passed to createNode should be the pot BEFORE the current street action?
    // OR, does createNode assume 'pot' is the money in the middle, and stacks are remaining?

    // Let's look at createNode usage:
    // createNode(pot, stack0, stack1, ...)
    // When betting: createNode(pot + betAmount, stack - betAmount, ...)

    // So 'pot' is the current pot in the middle.
    // 'stack' is the current stack in front of the player.

    // In GameState:
    // player.stack is chips BEHIND.
    // player.bet is chips IN FRONT (committed to current street).
    // gameState.pots contains previous streets' pot.

    // So, Total Pot currently = Sum(gameState.pots) + bet0 + bet1.
    // BUT, createNode treats 'betAmount' as something that gets added to the pot.
    // If we are mid-street, some bets are already made.

    // If we are at a node where P0 faces a bet of 50.
    // That means P1 has bet 50 more than P0.
    // The 'pot' at this node should include all money EXCEPT the pending call amount?
    // No, usually 'pot' is what's in the middle.

    // Let's trace:
    // P0 checks. Pot=100.
    // P1 bets 50.
    // -> createNode(100+50, s0, s1-50, 0, 50)
    // So the pot passed to the next node INCLUDES the bet.

    // So if we start mid-street:
    // Pot should be: Sum(pots) + bet0 + bet1.
    // Stacks should be: player.stack (chips behind).

    const currentPot = gameState.pots.reduce((sum, p) => sum + p.amount, 0) + bet0 + bet1;

    // Stacks
    const stack0 = oopPlayer.stack;
    const stack1 = ipPlayer.stack;

    function createNode(
        pot: number,
        stack0: number,
        stack1: number,
        playerToAct: number,
        facingBet: number,
        raisesRemaining: number
    ): CFRNode {
        const id = nodeId++;
        const actions: CFRAction[] = [];
        const children: CFRNode[] = [];

        // Calculate effective stacks
        const effectiveStack = Math.min(stack0, stack1);

        if (facingBet === 0) {
            // Not facing a bet: can check or bet

            // Check
            actions.push({ type: 'check', amount: 0 });

            // Check leads to either next player or showdown
            if (playerToAct === 0) {
                // P0 checks, P1 to act
                children.push(createNode(pot, stack0, stack1, 1, 0, raisesRemaining));
            } else {
                // P1 checks (after P0 checked), showdown
                children.push({
                    id: nodeId++,
                    playerToAct: -1,
                    actions: [],
                    children: [],
                    isTerminal: true,
                    payoff: 0 // Will be calculated based on hand strength
                });
            }

            // Bet sizes
            for (const sizeFrac of betSizes) {
                const betAmount = Math.min(Math.floor(pot * sizeFrac), effectiveStack);
                if (betAmount > 0) {
                    actions.push({ type: 'bet', amount: betAmount });

                    // After bet, opponent faces a bet
                    const newStack = playerToAct === 0
                        ? stack0 - betAmount
                        : stack1 - betAmount;

                    children.push(createNode(
                        pot + betAmount,
                        playerToAct === 0 ? newStack : stack0,
                        playerToAct === 1 ? newStack : stack1,
                        1 - playerToAct,
                        betAmount,
                        raisesRemaining
                    ));
                }
            }

            // All-in (if not already covered by bet sizes)
            if (effectiveStack > 0) {
                const allInAmount = playerToAct === 0 ? stack0 : stack1;
                const alreadyHasAllIn = actions.some(a => a.amount === allInAmount);

                if (!alreadyHasAllIn && allInAmount > 0) {
                    actions.push({ type: 'bet', amount: allInAmount });

                    children.push(createNode(
                        pot + allInAmount,
                        playerToAct === 0 ? 0 : stack0,
                        playerToAct === 1 ? 0 : stack1,
                        1 - playerToAct,
                        allInAmount,
                        raisesRemaining
                    ));
                }
            }

        } else {
            // Facing a bet: can fold, call, or raise

            // Fold
            actions.push({ type: 'fold', amount: 0 });
            children.push({
                id: nodeId++,
                playerToAct: -1,
                actions: [],
                children: [],
                isTerminal: true,
                // Fold: opponent wins the pot
                // If P0 folds, P1 wins -> payoff = -pot/2 for P0
                // If P1 folds, P0 wins -> payoff = +pot/2 for P0
                // CORRECTED: The pot includes the uncalled bet. The winner wins (pot - facingBet).
                // The uncalled bet is returned to the bettor and is not part of the won pot.
                payoff: playerToAct === 0 ? -(pot - facingBet) / 2 : (pot - facingBet) / 2
            });

            // Call
            const callAmount = Math.min(facingBet, playerToAct === 0 ? stack0 : stack1);
            actions.push({ type: 'call', amount: callAmount });

            // After call, check if all-in or showdown
            const newStack = playerToAct === 0
                ? stack0 - callAmount
                : stack1 - callAmount;

            // Showdown after call
            children.push({
                id: nodeId++,
                playerToAct: -1,
                actions: [],
                children: [],
                isTerminal: true,
                payoff: 0 // Will be calculated based on hand strength
            });

            // Raise (if allowed and has chips)
            if (raisesRemaining > 0) {
                const myStack = playerToAct === 0 ? stack0 : stack1;

                for (const sizeFrac of betSizes) {
                    const raiseTotal = Math.min(
                        Math.floor((pot + facingBet) * sizeFrac) + facingBet,
                        myStack
                    );

                    if (raiseTotal > facingBet) {
                        actions.push({ type: 'raise', amount: raiseTotal });

                        children.push(createNode(
                            pot + raiseTotal,
                            playerToAct === 0 ? stack0 - raiseTotal : stack0,
                            playerToAct === 1 ? stack1 - raiseTotal : stack1,
                            1 - playerToAct,
                            raiseTotal - facingBet, // New bet to face
                            raisesRemaining - 1
                        ));
                    }
                }

                // All-in raise
                if (myStack > facingBet) {
                    const alreadyHasAllIn = actions.some(a => a.amount === myStack);

                    if (!alreadyHasAllIn) {
                        actions.push({ type: 'raise', amount: myStack });

                        children.push(createNode(
                            pot + myStack,
                            playerToAct === 0 ? 0 : stack0,
                            playerToAct === 1 ? 0 : stack1,
                            1 - playerToAct,
                            myStack - facingBet,
                            0 // No more raises after all-in
                        ));
                    }
                }
            }
        }

        return {
            id,
            playerToAct,
            actions,
            children,
            isTerminal: false
        };
    }

    return createNode(currentPot, stack0, stack1, playerToAct, currentFacingBet, maxRaises);
}

/**
 * Extract the average strategy for a specific infoset.
 *
 * @param store InfosetStore
 * @param nodeId Node ID
 * @param cards Player's hole cards
 * @param board Community cards
 * @param numActions Number of actions at the node
 * @returns Array of action probabilities
 */
export function getStrategy(
    store: InfosetStore,
    nodeId: number,
    cards: Card[],
    board: Card[],
    numActions: number
): number[] {
    const key = store.generateKey(nodeId, cards, board);
    const data = store.get(key, numActions);
    const strategySums = InfosetStore.getStrategySums(data, numActions);

    const output = new Float64Array(numActions);
    getAverageStrategy(strategySums, output);

    return Array.from(output);
}

/**
 * Simple showdown evaluator for testing.
 * Compares two hands on a given board and returns payoff for Player 0.
 *
 * This is a placeholder - should integrate with the full hand evaluator.
 */
export function evaluateShowdown(
    cards0: Card[],
    cards1: Card[],
    board: Card[],
    pot: number
): number {
    // 1. Combine Hole Cards + Board
    const hand0 = [...cards0, ...board];
    const hand1 = [...cards1, ...board];

    // 2. Evaluate Strengths
    const strength0 = evaluate(hand0);
    const strength1 = evaluate(hand1);

    // 3. Compare (score is higher for better hands)
    if (strength0.score > strength1.score) {
        return pot / 2; // P0 Wins
    } else if (strength1.score > strength0.score) {
        return -pot / 2; // P1 Wins
    } else {
        return 0; // Split Pot
    }
}

/**
 * CFR traversal with showdown evaluation.
 *
 * Similar to cfr() but evaluates showdown nodes using hand evaluator.
 */
export function cfrWithShowdown(
    node: CFRNode,
    p0: number,
    p1: number,
    cards0: Card[],
    cards1: Card[],
    board: Card[],
    store: InfosetStore,
    evaluateShowdownFn: (cards0: Card[], cards1: Card[], board: Card[], pot: number) => number,
    currentPot: number
): number {
    // Terminal node
    if (node.isTerminal) {
        // If payoff is 0, it's a showdown
        if (node.payoff === 0) {
            return evaluateShowdownFn(cards0, cards1, board, currentPot);
        }
        return node.payoff!;
    }

    const player = node.playerToAct;
    const numActions = node.actions.length;

    const heroCards = player === 0 ? cards0 : cards1;
    const key = store.generateKey(node.id, heroCards, board);
    const data = store.get(key, numActions);

    const regrets = InfosetStore.getRegrets(data, numActions);
    const strategySums = InfosetStore.getStrategySums(data, numActions);

    const strategy = new Float64Array(numActions);
    regretMatch(regrets, strategy);

    const actionUtils = new Float64Array(numActions);
    let nodeUtil = 0;

    for (let i = 0; i < numActions; i++) {
        // No sign flip - all utilities from P0's perspective
        // Calculate new pot for recursive call
        // If action is bet/raise/call, it adds to the pot.
        // But wait, 'amount' in CFRAction is the TOTAL amount put in by the player?
        // Or the amount ADDED?
        // In buildRiverTree:
        // Bet: amount = betAmount. Pot becomes pot + betAmount.
        // Call: amount = callAmount. Pot becomes pot + callAmount.
        // Raise: amount = raiseTotal. Pot becomes pot + raiseTotal.
        // Wait, raiseTotal is total bet?
        // buildRiverTree logic:
        // Raise: children.push(createNode(pot + raiseTotal, ...))
        // So the child node's pot is indeed increased by the action amount.

        // However, we don't have easy access to the exact pot increase here without parsing the action type.
        // But we can approximate or use the node structure if we had it.
        // Since CFRNode doesn't store pot, we must rely on the action amount.

        // Let's assume action.amount is what gets added to the pot?
        // In buildRiverTree:
        // Bet: actions.push({ type: 'bet', amount: betAmount });
        // Call: actions.push({ type: 'call', amount: callAmount });
        // Raise: actions.push({ type: 'raise', amount: raiseTotal });

        // BUT for Raise, 'raiseTotal' is the TOTAL amount the player has put in?
        // Or the amount of the raise?
        // In buildRiverTree:
        // const raiseTotal = ...
        // actions.push({ type: 'raise', amount: raiseTotal });
        // children.push(createNode(pot + raiseTotal, ...))

        // It seems 'raiseTotal' is added to the pot in createNode.
        // BUT 'pot' in createNode is the pot BEFORE the action?
        // No, createNode(pot + raiseTotal, ...) means the child node has that pot.

        // So yes, we can add action.amount to currentPot for the child.
        // EXCEPT for Check/Fold (amount 0).

        const action = node.actions[i];
        const nextPot = currentPot + action.amount;

        if (player === 0) {
            actionUtils[i] = cfrWithShowdown(
                node.children[i],
                p0 * strategy[i],
                p1,
                cards0,
                cards1,
                board,
                store,
                evaluateShowdownFn,
                nextPot
            );
        } else {
            actionUtils[i] = cfrWithShowdown(
                node.children[i],
                p0,
                p1 * strategy[i],
                cards0,
                cards1,
                board,
                store,
                evaluateShowdownFn,
                nextPot
            );
        }

        nodeUtil += strategy[i] * actionUtils[i];
    }

    const opponentProb = player === 0 ? p1 : p0;
    const reachProb = player === 0 ? p0 : p1;

    for (let i = 0; i < numActions; i++) {
        // Negate for P1 since P1's utility = -P0's utility
        const regretMultiplier = player === 0 ? 1 : -1;
        regrets[i] += regretMultiplier * (actionUtils[i] - nodeUtil) * opponentProb;
        strategySums[i] += strategy[i] * reachProb;
    }

    return nodeUtil;
}
