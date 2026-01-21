/**
 * Pure mathematical analysis functions for poker decision metrics.
 * All functions are pure and take GameState as input.
 */

import { GameState, Player } from './types';

export interface GameStats {
  potOdds: number | null; // Percentage (0-100), null if no call required
  spr: number | null; // Stack-to-Pot Ratio, null if no pot
  mRatio: number | null; // M-Ratio, null if not applicable
  totalPot: number; // Current pot + all bets on table
  amountToCall: number; // How much hero needs to call
  effectiveStack: number; // Smallest stack between hero and active villains
  heroStack: number; // Hero's current stack
}

/**
 * Calculate the total pot including all pots and current street bets.
 */
export function calculateTotalPot(state: GameState): number {
  const potsTotal = state.pots.reduce((sum, pot) => sum + pot.amount, 0);
  const betsOnTable = state.players.reduce((sum, player) => sum + player.bet, 0);
  return potsTotal + betsOnTable;
}

/**
 * Calculate the amount a player needs to call to continue.
 */
export function calculateAmountToCall(state: GameState, seatIndex: number): number {
  const player = state.players.find(p => p.seat === seatIndex);
  if (!player) return 0;

  // If player is folded, all-in, or sitting out, no call needed
  if (player.status !== 'active') return 0;

  const amountToCall = state.currentBet - player.bet;
  return Math.max(0, amountToCall);
}

/**
 * Calculate pot odds as a percentage.
 * Formula: AmountToCall / (CurrentPot + BetsOnTable + AmountToCall) * 100
 *
 * Example: Pot 100, Villain bets 50, Hero must call 50
 * Total after call = 100 + 50 + 50 = 200
 * Odds = 50/200 = 25%
 */
export function calculatePotOdds(state: GameState, seatIndex: number): number | null {
  const amountToCall = calculateAmountToCall(state, seatIndex);

  // If no call needed, pot odds don't apply
  if (amountToCall <= 0) return null;

  const totalPot = calculateTotalPot(state);
  const potAfterCall = totalPot + amountToCall;

  // Avoid division by zero
  if (potAfterCall === 0) return null;

  return (amountToCall / potAfterCall) * 100;
}

/**
 * Find the effective stack - the smallest stack between hero and active villains.
 * This is crucial for commitment decisions.
 */
export function calculateEffectiveStack(state: GameState, seatIndex: number): number {
  const hero = state.players.find(p => p.seat === seatIndex);
  if (!hero) return 0;

  // Get all active opponents (not folded, not sitting out, not the hero)
  const activeVillains = state.players.filter(
    p => p.seat !== seatIndex &&
         (p.status === 'active' || p.status === 'all-in')
  );

  // If no active villains, return hero's stack
  if (activeVillains.length === 0) return hero.stack;

  // Find minimum stack among hero and all active villains
  const villainMinStack = Math.min(...activeVillains.map(p => p.stack + p.bet));
  const heroEffective = hero.stack + hero.bet;

  return Math.min(heroEffective, villainMinStack);
}

/**
 * Calculate Stack-to-Pot Ratio (SPR).
 * Formula: EffectiveStack / TotalPot
 *
 * Guidelines:
 * - SPR < 1: Usually auto all-in territory
 * - SPR 1-4: Committed with top pair+
 * - SPR 4-10: Need strong hands to commit
 * - SPR > 10: Can fold even sets in some spots
 */
export function calculateSPR(state: GameState, seatIndex: number): number | null {
  const totalPot = calculateTotalPot(state);

  // Avoid division by zero
  if (totalPot === 0) return null;

  const effectiveStack = calculateEffectiveStack(state, seatIndex);
  return effectiveStack / totalPot;
}

/**
 * Calculate M-Ratio (Tournament metric).
 * Formula: Stack / (BB + SB + Antes)
 *
 * Guidelines:
 * - M > 20: Green zone (full poker)
 * - M 10-20: Yellow zone (tight play)
 * - M 5-10: Orange zone (push/fold approaching)
 * - M < 5: Red zone (push/fold mode)
 */
export function calculateMRatio(state: GameState, seatIndex: number): number | null {
  const player = state.players.find(p => p.seat === seatIndex);
  if (!player) return null;

  const { smallBlind, bigBlind, ante } = state.config;
  const activePlayerCount = state.players.filter(
    p => p.status !== 'sitting-out'
  ).length;

  const totalAntes = ante * activePlayerCount;
  const blindsCost = smallBlind + bigBlind + totalAntes;

  // Avoid division by zero
  if (blindsCost === 0) return null;

  return player.stack / blindsCost;
}

/**
 * Main analysis function - calculates all stats for a given seat.
 * Pure function suitable for testing.
 */
export function analyzeState(state: GameState, seatIndex: number): GameStats {
  const hero = state.players.find(p => p.seat === seatIndex);
  const heroStack = hero?.stack ?? 0;

  const totalPot = calculateTotalPot(state);
  const amountToCall = calculateAmountToCall(state, seatIndex);
  const effectiveStack = calculateEffectiveStack(state, seatIndex);
  const potOdds = calculatePotOdds(state, seatIndex);
  const spr = calculateSPR(state, seatIndex);
  const mRatio = calculateMRatio(state, seatIndex);

  return {
    potOdds,
    spr,
    mRatio,
    totalPot,
    amountToCall,
    effectiveStack,
    heroStack,
  };
}

/**
 * Get color coding for pot odds display.
 * Green: Good odds (<20%)
 * Yellow: Marginal (20-40%)
 * Red: Expensive (>40%)
 */
export function getPotOddsColor(potOdds: number): 'green' | 'yellow' | 'red' {
  if (potOdds < 20) return 'green';
  if (potOdds <= 40) return 'yellow';
  return 'red';
}

/**
 * Get SPR zone description.
 */
export function getSPRZone(spr: number): string {
  if (spr < 1) return 'Committed';
  if (spr < 4) return 'Short';
  if (spr < 10) return 'Medium';
  return 'Deep';
}

/**
 * Get M-Ratio zone for tournament play.
 */
export function getMRatioZone(m: number): 'green' | 'yellow' | 'orange' | 'red' {
  if (m > 20) return 'green';
  if (m > 10) return 'yellow';
  if (m > 5) return 'orange';
  return 'red';
}
