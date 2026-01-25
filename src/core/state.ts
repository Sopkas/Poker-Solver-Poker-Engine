import { GameState, HandConfig, Player, Pot, Card, PlayerStatus, ScenarioConfig, Street } from './types';
import { createDeck, shuffleDeck, drawCards } from './deck';
import { createPRNG, PRNGState } from './prng';
import { validateTableConfig, validatePlayerStack, isValidChipAmount } from './validation';

/**
 * Validates that board card count matches the required count for a street.
 */
const validateBoardLength = (street: Street, boardCards: Card[]): void => {
    const required: Record<string, number> = { 'flop': 3, 'turn': 4, 'river': 5 };
    const expected = required[street];
    if (expected !== undefined && boardCards.length !== expected) {
        throw {
            code: 'INVALID_BOARD_LENGTH',
            message: `${street} requires exactly ${expected} board cards, got ${boardCards.length}`,
        };
    }
};

/**
 * Creates the initial state for a new hand.
 * This is a pure function.
 * 
 * Invariants:
 * - Conservation of Chips: sum(stacks) + sum(pots) = constant
 * - Card Uniqueness: each card appears exactly once (deck + hands + board)
 * - Determinism: f(config, seed) always produces the same state
 */
export const createInitialState = (config: HandConfig, scenarioConfig?: ScenarioConfig): GameState => {
    // === CRITICAL: Validate all numeric inputs ===
    // This prevents NaN, Infinity, or fractional values from corrupting state
    validateTableConfig(config.tableConfig);

    // Validate player stacks
    for (const player of config.players) {
        validatePlayerStack(player.stack, player.id);
    }

    // Validate scenario overrides if present
    if (scenarioConfig?.players) {
        for (const sp of scenarioConfig.players) {
            if (sp.stack !== undefined) {
                validatePlayerStack(sp.stack, `scenario player seat ${sp.seat}`);
            }
        }
    }

    // Validate dealer seat
    if (
        typeof config.dealerSeat !== 'number' ||
        !Number.isInteger(config.dealerSeat) ||
        config.dealerSeat < 0 ||
        config.dealerSeat >= config.tableConfig.maxSeats
    ) {
        throw {
            code: 'INVALID_DEALER_SEAT',
            message: `dealerSeat must be an integer between 0 and ${config.tableConfig.maxSeats - 1}. Got: ${config.dealerSeat}`,
        };
    }

    // 1. Initialize PRNG
    let rngState = createPRNG(config.seed);

    // 2. Create Deck and Handle Scenario Overrides
    const fullDeck = createDeck();
    let deckToShuffle = fullDeck;

    // Map of seat -> pre-assigned cards
    const preAssignedCards = new Map<number, Card[]>();

    if (scenarioConfig?.players) {
        scenarioConfig.players.forEach(sp => {
            if (sp.cards && sp.cards.length > 0) {
                preAssignedCards.set(sp.seat, sp.cards);

                // Remove these cards from the deck to be shuffled
                sp.cards.forEach(c => {
                    deckToShuffle = deckToShuffle.filter(dc => !(dc.rank === c.rank && dc.suit === c.suit));
                });
            }
        });
    }

    // Scenario Builder: Remove board cards from deck
    let scenarioBoardCards: Card[] = [];
    if (scenarioConfig?.scenario) {
        const { startStreet, boardCards, deadCards } = scenarioConfig.scenario;

        // Validate board length if not preflop
        if (startStreet !== 'preflop') {
            validateBoardLength(startStreet, boardCards);
            scenarioBoardCards = boardCards;

            // Remove board cards from deck
            boardCards.forEach(c => {
                deckToShuffle = deckToShuffle.filter(dc => !(dc.rank === c.rank && dc.suit === c.suit));
            });
        }

        // Remove dead cards from deck
        if (deadCards) {
            deadCards.forEach(c => {
                deckToShuffle = deckToShuffle.filter(dc => !(dc.rank === c.rank && dc.suit === c.suit));
            });
        }
    }

    // Shuffle the remaining deck
    const { deck: shuffledDeck, rngState: rngAfterShuffle } = shuffleDeck(deckToShuffle, rngState);
    rngState = rngAfterShuffle;
    let currentDeck = shuffledDeck;

    // 3. Create Players
    const players: Player[] = config.players.map(p => {
        // Check for scenario overrides for stack
        let startStack = p.stack;
        if (scenarioConfig?.players) {
            const scenarioPlayer = scenarioConfig.players.find(sp => sp.seat === p.seat);
            if (scenarioPlayer?.stack) {
                startStack = scenarioPlayer.stack;
            }
        }

        return {
            id: p.id,
            seat: p.seat,
            name: p.name,
            stack: startStack,
            bet: 0,
            totalBet: 0,
            status: 'active' as PlayerStatus,
            holeCards: [],
            hasActed: false,
            actedOnStreet: false,
            startHandStack: startStack,
        };
    });

    // 4. Identify SB/BB Positions (relative to dealer)
    const activePlayers = players.filter(p => p.status !== 'sitting-out');
    if (activePlayers.length < 2) {
        throw new Error('Need at least 2 active players to start a hand');
    }

    // Sort by seat to find positions relative to dealer
    const sortedByProximity = [...activePlayers].sort((a, b) => {
        const aDist = (a.seat - config.dealerSeat + config.tableConfig.maxSeats) % config.tableConfig.maxSeats;
        const bDist = (b.seat - config.dealerSeat + config.tableConfig.maxSeats) % config.tableConfig.maxSeats;
        return aDist - bDist;
    });

    // For heads-up, dealer is SB. Otherwise, SB is next player after dealer.
    let sbPlayer: Player | null = null;
    let bbPlayer: Player;

    if (activePlayers.length === 2) {
        // Heads-Up: Dealer is SB, Opponent is BB
        sbPlayer = sortedByProximity[0]; // Dealer
        bbPlayer = sortedByProximity[1]; // Opponent
    } else {
        // 3+ Players: Check for Dead SB
        // Find first active player after dealer
        // If dealer is active, sortedByProximity[0] is dealer. Next is [1].
        // If dealer is inactive (Dead Button), sortedByProximity[0] is next active.
        const dealerIsActive = sortedByProximity[0].seat === config.dealerSeat;
        const nextActive = dealerIsActive ? sortedByProximity[1] : sortedByProximity[0];

        const dist = (nextActive.seat - config.dealerSeat + config.tableConfig.maxSeats) % config.tableConfig.maxSeats;

        if (dist === 1) {
            // Normal SB
            sbPlayer = nextActive;
            const sbIndexInSorted = sortedByProximity.indexOf(sbPlayer);
            bbPlayer = sortedByProximity[(sbIndexInSorted + 1) % sortedByProximity.length];
        } else {
            // Dead SB (gap between dealer and next active > 1)
            sbPlayer = null;
            bbPlayer = nextActive;
        }
    }

    // UTG is next after BB
    const bbIndexInSorted = sortedByProximity.findIndex(p => p.id === bbPlayer.id);
    const utgPlayer = sortedByProximity[(bbIndexInSorted + 1) % sortedByProximity.length];

    // Check if this is a post-flop scenario (skip blinds/antes)
    const isPostFlopScenario = scenarioConfig?.scenario?.startStreet &&
        scenarioConfig.scenario.startStreet !== 'preflop';

    // 5. Post Antes (if applicable and not post-flop scenario)
    let potAmount = 0;
    if (config.tableConfig.ante > 0 && !isPostFlopScenario) {
        players.forEach(p => {
            if (p.status === 'active') {
                const anteAmount = Math.min(p.stack, config.tableConfig.ante);
                p.stack -= anteAmount;
                p.totalBet += anteAmount;
                potAmount += anteAmount;
                if (p.stack === 0) p.status = 'all-in';
            }
        });
    }

    // 6. Post Blinds (skip for post-flop scenarios - blinds already collected)
    if (!isPostFlopScenario) {
        // SB (if not dead)
        if (sbPlayer) {
            const sbIndex = players.findIndex(p => p.id === sbPlayer.id);
            const sbAmount = Math.min(players[sbIndex].stack, config.tableConfig.smallBlind);
            players[sbIndex].stack -= sbAmount;
            players[sbIndex].bet = sbAmount;
            players[sbIndex].totalBet += sbAmount;
            potAmount += sbAmount;
            if (players[sbIndex].stack === 0) players[sbIndex].status = 'all-in';
        }

        // BB
        const bbIndex = players.findIndex(p => p.id === bbPlayer.id);
        const bbAmount = Math.min(players[bbIndex].stack, config.tableConfig.bigBlind);
        players[bbIndex].stack -= bbAmount;
        players[bbIndex].bet = bbAmount;
        players[bbIndex].totalBet += bbAmount;
        potAmount += bbAmount;
        if (players[bbIndex].stack === 0) players[bbIndex].status = 'all-in';
    }

    // 7. Deal Hole Cards (2 per active player)
    // Deal in order: SB first, then around the table
    const dealOrder = [...sortedByProximity];
    if (activePlayers.length > 2) {
        // Remove dealer from deal order start, start from SB
        const dealerIdx = dealOrder.findIndex(p => p.seat === config.dealerSeat);
        if (dealerIdx !== -1) {
            dealOrder.splice(dealerIdx, 1);
            dealOrder.push(activePlayers.find(p => p.seat === config.dealerSeat)!);
        }
    }

    for (const p of dealOrder) {
        const pIndex = players.findIndex(pl => pl.id === p.id);
        if (players[pIndex].status === 'active' || players[pIndex].status === 'all-in') {
            // Check if player has pre-assigned cards
            const assigned = preAssignedCards.get(p.seat);

            if (assigned) {
                players[pIndex].holeCards = assigned;
            } else {
                const { drawn, remaining } = drawCards(currentDeck, 2);
                currentDeck = remaining;
                players[pIndex].holeCards = drawn;
            }
        }
    }

    // 8. Determine Action Seat (UTG in 6-max, SB in heads-up)
    // If SB is dead, action starts at UTG?
    // Standard: Preflop action starts at UTG (left of BB).
    // Heads-Up: SB acts first.

    let actionSeat: number;
    if (activePlayers.length === 2) {
        actionSeat = sbPlayer!.seat;
    } else {
        actionSeat = utgPlayer.seat;
    }

    // Scenario Builder: Determine initial street, board, pot, and action seat
    let initialStreet: Street = 'preflop';
    let initialBoard: Card[] = [];
    let initialPotAmount = 0;
    let scenarioActionSeat = actionSeat;

    if (scenarioConfig?.scenario && scenarioConfig.scenario.startStreet !== 'preflop') {
        const { startStreet, initialPot, boardCards } = scenarioConfig.scenario;
        initialStreet = startStreet;
        initialBoard = boardCards;
        initialPotAmount = initialPot;

        // Post-flop action starts with first active player left of dealer
        const maxSeats = config.tableConfig.maxSeats;
        let seat = (config.dealerSeat + 1) % maxSeats;
        let checked = 0;
        while (checked < maxSeats) {
            const player = players.find(p => p.seat === seat && p.status === 'active');
            if (player) {
                scenarioActionSeat = seat;
                break;
            }
            seat = (seat + 1) % maxSeats;
            checked++;
        }
    }

    // Create pot with scenario initial pot as dead money
    const initialPot: Pot = {
        amount: initialPotAmount,
        eligiblePlayers: activePlayers.map(p => p.id),
    };

    return {
        config: config.tableConfig,
        rngState,
        deck: currentDeck,
        players,
        pots: [initialPot],
        communityCards: initialBoard,
        street: initialStreet,
        dealerSeat: config.dealerSeat,
        actionSeat: scenarioActionSeat,
        minRaise: config.tableConfig.bigBlind,
        currentBet: initialStreet === 'preflop' ? config.tableConfig.bigBlind : 0,
        lastAggressor: null,
        lastRaiseIsFull: true,
    };
};

/**
 * Calculates the total chips in play (stacks + pots).
 * Used for invariant checks.
 */
export const getTotalChips = (state: GameState): number => {
    const stackSum = state.players.reduce((sum, p) => sum + p.stack, 0);
    const potSum = state.pots.reduce((sum, p) => sum + p.amount, 0);
    const betSum = state.players.reduce((sum, p) => sum + p.bet, 0);
    return stackSum + potSum + betSum;
};

/**
 * Checks for duplicate cards (invariant check).
 */
export const checkCardUniqueness = (state: GameState): string[] => {
    const errors: string[] = [];
    const seen = new Set<string>();

    const checkCard = (card: Card, location: string) => {
        const key = `${card.rank}${card.suit}`;
        if (seen.has(key)) {
            errors.push(`Duplicate card ${key} found in ${location}`);
        }
        seen.add(key);
    };

    state.deck.forEach((c, i) => checkCard(c, `Deck[${i}]`));
    state.communityCards.forEach((c, i) => checkCard(c, `Board[${i}]`));
    state.players.forEach(p => {
        p.holeCards.forEach((c, i) => checkCard(c, `Player ${p.id} Card ${i}`));
    });

    return errors;
};

/**
 * Prepares the state for the next hand, preserving stacks and rotating the dealer.
 */
export const prepareNextHand = (previousState: GameState): GameState => {
    // 1. Filter and Reset Players
    const players = previousState.players
        .filter(p => p.stack > 0)
        .map(p => ({
            ...p,
            bet: 0,
            totalBet: 0,
            status: 'active' as PlayerStatus,
            holeCards: [] as Card[],
            hasActed: false,
            actedOnStreet: false,
            startHandStack: p.stack,
        }));

    if (players.length < 2) {
        throw new Error('Game Over: Not enough players remaining');
    }

    // 2. Rotate Dealer
    const activeSeats = players.map(p => p.seat).sort((a, b) => a - b);
    let nextDealerSeat = activeSeats.find(s => s > previousState.dealerSeat);
    if (nextDealerSeat === undefined) {
        nextDealerSeat = activeSeats[0];
    }

    // 3. Continue RNG
    let rngState = previousState.rngState;

    // 4. Create and Shuffle Deck
    const unshuffled = createDeck();
    const { deck: shuffledDeck, rngState: rngAfterShuffle } = shuffleDeck(unshuffled, rngState);
    rngState = rngAfterShuffle;
    let currentDeck = shuffledDeck;

    // 5. Identify SB/BB Positions
    // Sort by seat to find positions relative to dealer
    const sortedByProximity = [...players].sort((a, b) => {
        const aDist = (a.seat - nextDealerSeat + previousState.config.maxSeats) % previousState.config.maxSeats;
        const bDist = (b.seat - nextDealerSeat + previousState.config.maxSeats) % previousState.config.maxSeats;
        return aDist - bDist;
    });

    const dealerIsActive = sortedByProximity[0].seat === nextDealerSeat;
    // Note: nextDealerSeat was chosen from activeSeats, so dealer MUST be active in this logic
    // unless nextDealerSeat logic is flawed.
    // activeSeats = players.map(p => p.seat). So nextDealerSeat is definitely an active seat.

    let sbPlayer: Player | null = null;
    let bbPlayer: Player;

    if (players.length === 2) {
        sbPlayer = sortedByProximity[0];
        bbPlayer = sortedByProximity[1];
    } else {
        // 3+ Players
        const nextActive = sortedByProximity[1]; // Since sorted[0] is Dealer

        // In active-player-based rotation, the next active player is always SB
        // regardless of physical seat distance (unless specific dead button rules apply, 
        // but for simplified logic, next active is SB).
        sbPlayer = nextActive;
        const sbIndexInSorted = sortedByProximity.indexOf(sbPlayer);
        bbPlayer = sortedByProximity[(sbIndexInSorted + 1) % sortedByProximity.length];
    }

    const bbIndexInSorted = sortedByProximity.findIndex(p => p.id === bbPlayer.id);

    // 6. Post Antes
    let potAmount = 0;
    if (previousState.config.ante > 0) {
        players.forEach(p => {
            const anteAmount = Math.min(p.stack, previousState.config.ante);
            p.stack -= anteAmount;
            p.totalBet += anteAmount;
            potAmount += anteAmount;
            if (p.stack === 0) p.status = 'all-in';
        });
    }

    // 7. Post Blinds
    // SB
    if (sbPlayer) {
        const sbIndex = players.findIndex(p => p.id === sbPlayer.id);
        const sbAmount = Math.min(players[sbIndex].stack, previousState.config.smallBlind);
        players[sbIndex].stack -= sbAmount;
        players[sbIndex].bet = sbAmount;
        players[sbIndex].totalBet += sbAmount;
        potAmount += sbAmount;
        if (players[sbIndex].stack === 0) players[sbIndex].status = 'all-in';
    }

    // BB
    const bbIndex = players.findIndex(p => p.id === bbPlayer.id);
    const bbAmount = Math.min(players[bbIndex].stack, previousState.config.bigBlind);
    players[bbIndex].stack -= bbAmount;
    players[bbIndex].bet = bbAmount;
    players[bbIndex].totalBet += bbAmount;
    potAmount += bbAmount;
    if (players[bbIndex].stack === 0) players[bbIndex].status = 'all-in';

    // 8. Deal Hole Cards
    const dealOrder = [...sortedByProximity];
    if (players.length > 2) {
        const dealerIdx = dealOrder.findIndex(p => p.seat === nextDealerSeat);
        if (dealerIdx !== -1) {
            dealOrder.splice(dealerIdx, 1);
            dealOrder.push(players.find(p => p.seat === nextDealerSeat)!);
        }
    }

    for (const p of dealOrder) {
        const pIndex = players.findIndex(pl => pl.id === p.id);
        if (players[pIndex].status === 'active' || players[pIndex].status === 'all-in') {
            const { drawn, remaining } = drawCards(currentDeck, 2);
            currentDeck = remaining;
            players[pIndex].holeCards = drawn;
        }
    }

    // 9. Determine Action Seat
    let actionSeat: number;
    if (players.length === 2) {
        // Heads-Up: SB acts first preflop
        actionSeat = sbPlayer!.seat;
    } else {
        // 3+ Players: UTG acts first (player left of BB)
        // We use the sorted active seats to find the next player after BB
        const activeSeats = players.map(p => p.seat).sort((a, b) => a - b);
        const bbSeatIdx = activeSeats.indexOf(bbPlayer.seat);

        // UTG is the next active seat after BB
        // This handles wrapping around correctly (e.g. BB is seat 5, UTG is seat 0)
        const utgSeat = activeSeats[(bbSeatIdx + 1) % activeSeats.length];
        actionSeat = utgSeat;
    }

    // 10. Create Initial Pot
    const pot: Pot = {
        amount: 0, // Blinds are in player.bet, not yet in pot
        eligiblePlayers: players.map(p => p.id),
    };

    return {
        config: previousState.config,
        rngState,
        deck: currentDeck,
        players,
        pots: [pot],
        communityCards: [],
        street: 'preflop',
        dealerSeat: nextDealerSeat,
        actionSeat,
        minRaise: previousState.config.bigBlind,
        currentBet: previousState.config.bigBlind,
        lastAggressor: null,
        lastRaiseIsFull: true,
    };
};
