// --- Primitives ---
export type Suit = 'h' | 'd' | 'c' | 's';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type PlayerStatus = 'active' | 'folded' | 'all-in' | 'sitting-out';

// --- Player ---
export interface Player {
  id: string;
  seat: number; // 0-5
  name: string;
  stack: number; // Chips currently in front of player
  bet: number; // Chips committed to the current street
  totalBet: number; // Total chips committed this hand (for side pot calc)
  status: PlayerStatus;
  holeCards: Card[];
  hasActed: boolean; // False at start of street, true after action
  actedOnStreet: boolean; // True if player has acted at least once on this street (for re-raise rules)
  startHandStack: number; // Stack at start of hand (for ranking)
}

// --- Pot ---
export interface Pot {
  amount: number;
  eligiblePlayers: string[]; // Player IDs who can win this pot
}

// --- Table Config ---
export interface TableConfig {
  maxSeats: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
}

// --- PRNG State (for serialization) ---
export interface PRNGState {
  seed: number;
  state: number;
}

// --- Game State (Canonical JSON) ---
export interface GameState {
  config: TableConfig;
  rngState: PRNGState; // Current internal state of the RNG
  deck: Card[]; // Cards remaining to be dealt
  players: Player[];
  pots: Pot[];
  communityCards: Card[];
  street: Street;
  dealerSeat: number;
  actionSeat: number; // The seat index of the player who must act
  minRaise: number; // The minimum raise amount valid right now
  currentBet: number; // The highest bet on the current street
  lastAggressor: number | null; // Seat of the last player to bet/raise (null if no aggression)
  lastRaiseIsFull: boolean; // True if the last raise was a full raise (>= minRaise)
  winners?: { playerId: string; amount: number; handRank: string }[]; // Winners of the last showdown
}

// --- Actions ---
export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'next-hand';

export interface Action {
  street: Street;
  playerId: string;
  type: ActionType;
  amount: number;
  isAllIn: boolean;
  timestamp: number;
}

// --- Showdown Result ---
export interface ShowdownResult {
  winners: { playerId: string; amount: number; handRank: string }[];
  ranks: { playerId: string; rank: string; score: number; bestHand: Card[] }[];
}

// --- Hand Config (for starting a new hand) ---
export interface HandConfig {
  id: string;
  players: { id: string; name: string; stack: number; seat: number }[];
  tableConfig: TableConfig;
  dealerSeat: number;
  seed: number;
}

// --- Scenario Config (God Mode) ---
export interface ScenarioPlayer {
  seat: number;
  name?: string;
  stack?: number;
  cards?: Card[]; // Pre-defined hole cards
}

export interface ScenarioConfig {
  numPlayers: number;
  smallBlind: number;
  bigBlind: number;
  startingStack: number;
  heroSeat: number;
  dealerSeat?: number;
  players?: ScenarioPlayer[];
  // Scenario Builder (God Mode ++) - Start at any street with custom board/pot
  scenario?: {
    startStreet: 'preflop' | 'flop' | 'turn' | 'river';
    initialPot: number;
    boardCards: Card[];
    deadCards?: Card[];  // Additional cards to remove from deck
  };
}
