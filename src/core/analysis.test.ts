/**
 * Analysis Module Tests
 *
 * Tests for pot odds, SPR, M-ratio, and other decision metrics.
 */

import {
  analyzeState,
  calculatePotOdds,
  calculateSPR,
  calculateMRatio,
  calculateTotalPot,
  calculateAmountToCall,
  calculateEffectiveStack,
  getPotOddsColor,
  getSPRZone,
  getMRatioZone,
} from './analysis';
import { GameState, Player, Pot, TableConfig, Street } from './types';

// --- Test Fixtures ---

const createMockPlayer = (overrides: Partial<Player> = {}): Player => ({
  id: 'p1',
  seat: 0,
  name: 'Player 1',
  stack: 1000,
  bet: 0,
  totalBet: 0,
  status: 'active',
  holeCards: [],
  hasActed: false,
  actedOnStreet: false,
  startHandStack: 1000,
  ...overrides,
});

const createMockConfig = (overrides: Partial<TableConfig> = {}): TableConfig => ({
  maxSeats: 6,
  smallBlind: 10,
  bigBlind: 20,
  ante: 0,
  ...overrides,
});

const createMockState = (overrides: Partial<GameState> = {}): GameState => ({
  config: createMockConfig(),
  rngState: { seed: 12345, state: 12345 },
  deck: [],
  players: [],
  pots: [{ amount: 0, eligiblePlayers: [] }],
  communityCards: [],
  street: 'preflop' as Street,
  dealerSeat: 0,
  actionSeat: 0,
  minRaise: 20,
  currentBet: 0,
  lastAggressor: null,
  lastRaiseIsFull: true,
  ...overrides,
});

// --- Verification Case Test ---

describe('Verification Case: Preflop BTN raise to 60', () => {
  /**
   * Scenario: Preflop. Blinds 10/20.
   * - SB posts 10
   * - BB (Hero) posts 20
   * - BTN raises to 60
   *
   * Math Check:
   * - Pot before Hero acts: 10 (SB) + 60 (BTN bet) + 20 (Hero's BB) = 90 in bets
   * - Amount to Call: 60 - 20 = 40
   * - Total Pot after Call: 90 + 40 = 130
   * - Expected Odds: 40 / 130 ≈ 30.77%
   */

  const verificationState = createMockState({
    config: createMockConfig({ smallBlind: 10, bigBlind: 20 }),
    players: [
      createMockPlayer({ id: 'btn', seat: 0, name: 'BTN', stack: 940, bet: 60, status: 'active' }),
      createMockPlayer({ id: 'sb', seat: 1, name: 'SB', stack: 990, bet: 10, status: 'folded' }),
      createMockPlayer({ id: 'bb', seat: 2, name: 'BB (Hero)', stack: 980, bet: 20, status: 'active' }),
    ],
    pots: [{ amount: 0, eligiblePlayers: ['btn', 'sb', 'bb'] }],
    currentBet: 60,
    actionSeat: 2, // BB to act
    street: 'preflop',
  });

  test('calculates correct total pot (bets on table)', () => {
    const totalPot = calculateTotalPot(verificationState);
    // 60 (BTN) + 10 (SB) + 20 (BB) = 90
    expect(totalPot).toBe(90);
  });

  test('calculates correct amount to call', () => {
    const heroSeat = 2; // BB
    const amountToCall = calculateAmountToCall(verificationState, heroSeat);
    // currentBet (60) - hero's bet (20) = 40
    expect(amountToCall).toBe(40);
  });

  test('calculates pot odds of ~30.77%', () => {
    const heroSeat = 2; // BB
    const potOdds = calculatePotOdds(verificationState, heroSeat);

    // 40 / (90 + 40) = 40 / 130 ≈ 30.77%
    expect(potOdds).not.toBeNull();
    expect(potOdds).toBeCloseTo(30.77, 1);
  });

  test('analyzeState returns expected values', () => {
    const heroSeat = 2; // BB
    const stats = analyzeState(verificationState, heroSeat);

    expect(stats.totalPot).toBe(90);
    expect(stats.amountToCall).toBe(40);
    expect(stats.potOdds).toBeCloseTo(30.77, 1);
    expect(stats.heroStack).toBe(980);
  });
});

// --- Pot Odds Tests ---

describe('calculatePotOdds', () => {
  test('returns null when no call needed (check situation)', () => {
    const state = createMockState({
      players: [
        createMockPlayer({ seat: 0, bet: 20 }),
        createMockPlayer({ seat: 1, bet: 20 }),
      ],
      currentBet: 20,
    });

    expect(calculatePotOdds(state, 0)).toBeNull();
  });

  test('calculates correct odds for simple bet scenario', () => {
    // Pot 100, Villain bets 50, Hero must call 50
    // Odds = 50 / (100 + 50 + 50) = 50 / 200 = 25%
    const state = createMockState({
      players: [
        createMockPlayer({ seat: 0, bet: 50 }), // Villain
        createMockPlayer({ seat: 1, bet: 0 }),  // Hero
      ],
      pots: [{ amount: 100, eligiblePlayers: ['p1', 'p2'] }],
      currentBet: 50,
    });

    const potOdds = calculatePotOdds(state, 1);
    expect(potOdds).toBeCloseTo(25, 1);
  });

  test('calculates correct odds for raise scenario', () => {
    // Pot 30, Villain raises to 100 (has 100 bet), Hero has 50 bet, needs 50 more
    // Total = 30 + 100 + 50 = 180
    // Pot after call = 180 + 50 = 230
    // Odds = 50 / 230 ≈ 21.74%
    const state = createMockState({
      players: [
        createMockPlayer({ seat: 0, bet: 100 }), // Villain
        createMockPlayer({ seat: 1, bet: 50 }),  // Hero
      ],
      pots: [{ amount: 30, eligiblePlayers: ['p1', 'p2'] }],
      currentBet: 100,
    });

    const potOdds = calculatePotOdds(state, 1);
    expect(potOdds).toBeCloseTo(21.74, 1);
  });
});

// --- SPR Tests ---

describe('calculateSPR', () => {
  test('returns null when pot is zero', () => {
    const state = createMockState({
      players: [createMockPlayer({ seat: 0, stack: 1000 })],
      pots: [{ amount: 0, eligiblePlayers: [] }],
    });

    expect(calculateSPR(state, 0)).toBeNull();
  });

  test('calculates SPR correctly with single opponent', () => {
    // Hero stack 500, Villain stack 300, Pot 100
    // Effective stack = min(500, 300) = 300
    // SPR = 300 / 100 = 3.0
    const state = createMockState({
      players: [
        createMockPlayer({ seat: 0, stack: 500 }),
        createMockPlayer({ seat: 1, stack: 300 }),
      ],
      pots: [{ amount: 100, eligiblePlayers: ['p1', 'p2'] }],
    });

    expect(calculateSPR(state, 0)).toBeCloseTo(3.0, 1);
  });

  test('calculates SPR with multiple opponents (uses smallest stack)', () => {
    // Hero stack 1000, Villain1 stack 500, Villain2 stack 200, Pot 100
    // Effective stack = min(1000, 500, 200) = 200
    // SPR = 200 / 100 = 2.0
    const state = createMockState({
      players: [
        createMockPlayer({ id: 'hero', seat: 0, stack: 1000 }),
        createMockPlayer({ id: 'v1', seat: 1, stack: 500 }),
        createMockPlayer({ id: 'v2', seat: 2, stack: 200 }),
      ],
      pots: [{ amount: 100, eligiblePlayers: ['hero', 'v1', 'v2'] }],
    });

    expect(calculateSPR(state, 0)).toBeCloseTo(2.0, 1);
  });

  test('ignores folded players for effective stack', () => {
    // Hero stack 500, Active Villain stack 400, Folded player stack 100
    // Effective = min(500, 400) = 400 (folded player ignored)
    const state = createMockState({
      players: [
        createMockPlayer({ id: 'hero', seat: 0, stack: 500 }),
        createMockPlayer({ id: 'active', seat: 1, stack: 400, status: 'active' }),
        createMockPlayer({ id: 'folded', seat: 2, stack: 100, status: 'folded' }),
      ],
      pots: [{ amount: 100, eligiblePlayers: ['hero', 'active'] }],
    });

    expect(calculateSPR(state, 0)).toBeCloseTo(4.0, 1);
  });
});

// --- Effective Stack Tests ---

describe('calculateEffectiveStack', () => {
  test('includes current bets in effective stack calculation', () => {
    // Hero: stack 480, bet 20. Villain: stack 450, bet 50
    // Hero effective = 480 + 20 = 500
    // Villain effective = 450 + 50 = 500
    // Effective = min(500, 500) = 500
    const state = createMockState({
      players: [
        createMockPlayer({ seat: 0, stack: 480, bet: 20 }),
        createMockPlayer({ seat: 1, stack: 450, bet: 50 }),
      ],
    });

    expect(calculateEffectiveStack(state, 0)).toBe(500);
  });
});

// --- M-Ratio Tests ---

describe('calculateMRatio', () => {
  test('calculates M-ratio correctly without antes', () => {
    // Stack 100, SB 5, BB 10, no ante
    // M = 100 / (5 + 10 + 0) = 100 / 15 ≈ 6.67
    const state = createMockState({
      config: createMockConfig({ smallBlind: 5, bigBlind: 10, ante: 0 }),
      players: [createMockPlayer({ seat: 0, stack: 100 })],
    });

    expect(calculateMRatio(state, 0)).toBeCloseTo(6.67, 1);
  });

  test('calculates M-ratio correctly with antes', () => {
    // Stack 100, SB 5, BB 10, ante 1, 6 players
    // M = 100 / (5 + 10 + 6) = 100 / 21 ≈ 4.76
    const state = createMockState({
      config: createMockConfig({ smallBlind: 5, bigBlind: 10, ante: 1 }),
      players: [
        createMockPlayer({ id: 'p1', seat: 0, stack: 100 }),
        createMockPlayer({ id: 'p2', seat: 1, stack: 100 }),
        createMockPlayer({ id: 'p3', seat: 2, stack: 100 }),
        createMockPlayer({ id: 'p4', seat: 3, stack: 100 }),
        createMockPlayer({ id: 'p5', seat: 4, stack: 100 }),
        createMockPlayer({ id: 'p6', seat: 5, stack: 100 }),
      ],
    });

    expect(calculateMRatio(state, 0)).toBeCloseTo(4.76, 1);
  });
});

// --- Color/Zone Helper Tests ---

describe('getPotOddsColor', () => {
  test('returns green for < 20%', () => {
    expect(getPotOddsColor(10)).toBe('green');
    expect(getPotOddsColor(19.9)).toBe('green');
  });

  test('returns yellow for 20-40%', () => {
    expect(getPotOddsColor(20)).toBe('yellow');
    expect(getPotOddsColor(30)).toBe('yellow');
    expect(getPotOddsColor(40)).toBe('yellow');
  });

  test('returns red for > 40%', () => {
    expect(getPotOddsColor(40.1)).toBe('red');
    expect(getPotOddsColor(50)).toBe('red');
  });
});

describe('getSPRZone', () => {
  test('returns correct zones', () => {
    expect(getSPRZone(0.5)).toBe('Committed');
    expect(getSPRZone(2)).toBe('Short');
    expect(getSPRZone(6)).toBe('Medium');
    expect(getSPRZone(15)).toBe('Deep');
  });
});

describe('getMRatioZone', () => {
  test('returns correct zones', () => {
    expect(getMRatioZone(25)).toBe('green');
    expect(getMRatioZone(15)).toBe('yellow');
    expect(getMRatioZone(7)).toBe('orange');
    expect(getMRatioZone(3)).toBe('red');
  });
});
