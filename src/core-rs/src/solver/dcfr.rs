//! Discounted CFR (DCFR) Engine.
//!
//! Implements the core CFR algorithm with discounted regret updates.
//! Based on TexasSolver implementation.

use crate::solver::arena::{GameTree, NodeType};

/// Local log macro for console output
macro_rules! log {
    ($($t:tt)*) => (web_sys::console::log_1(&format!($($t)*).into()))
}

/// DCFR Discount parameters (from TexasSolver).
const ALPHA: f32 = 1.5;
const BETA: f32 = 0.5;
const GAMMA: f32 = 2.0;
const THETA: f32 = 0.9;

/// The DCFR Trainer holding the mutable state of the solver.
pub struct DCFRTrainer {
    /// Accumulated regrets R+ for each action in each infoset.
    /// Flattened: [infoset_id * max_hands * max_actions + hand_idx * max_actions + action_idx]
    pub regrets: Vec<f32>,

    /// Accumulated strategy for averaging (cum_r_plus in TexasSolver).
    /// Flattened same as regrets.
    pub strategy_sum: Vec<f32>,

    /// Sum of positive regrets for regret matching.
    /// Flattened: [infoset_id * max_hands + hand_idx]
    regret_sum: Vec<f32>,

    /// Maximum number of actions for any node.
    max_actions: usize,

    /// Maximum number of hands (max(range0, range1)).
    max_hands: usize,

    /// Number of hands for each player.
    num_hands: [usize; 2],

    /// Current iteration count.
    pub iterations: usize,
}

impl DCFRTrainer {
    pub fn max_actions(&self) -> usize {
        self.max_actions
    }

    /// Get average strategy for a specific infoset and hand.
    ///
    /// # Arguments
    /// * `infoset_id` - The infoset ID
    /// * `hand_idx` - Index of the hand in the range
    /// * `num_actions` - Optional: actual number of actions at this node (for correct uniform)
    pub fn get_average_strategy(&self, infoset_id: usize, hand_idx: usize) -> Vec<f32> {
        self.get_average_strategy_with_actions(infoset_id, hand_idx, self.max_actions)
    }

    /// Get average strategy with specific number of actions
    pub fn get_average_strategy_with_actions(&self, infoset_id: usize, hand_idx: usize, num_actions: usize) -> Vec<f32> {
        let mut strategy = vec![0.0; self.max_actions];
        let base_idx = infoset_id * self.max_hands * self.max_actions + hand_idx * self.max_actions;

        // Debug: Log the raw strategy_sum values
        let raw_values: Vec<f32> = (0..num_actions.min(self.max_actions))
            .map(|a| self.strategy_sum[base_idx + a])
            .collect();

        let mut sum = 0.0;
        // Only sum over actual actions at this node
        for a in 0..num_actions.min(self.max_actions) {
            let s = self.strategy_sum[base_idx + a];
            if s > 0.0 {
                strategy[a] = s;
                sum += s;
            }
        }

        if sum > 0.0 {
            for a in 0..num_actions.min(self.max_actions) {
                strategy[a] /= sum;
            }
            log!("[get_average_strategy] infoset={}, hand={}, num_actions={}, sum={:.4}, strategy={:?}",
                 infoset_id, hand_idx, num_actions, sum, &strategy[0..num_actions]);
        } else {
            // Default uniform - use actual num_actions for correct probability
            let prob = 1.0 / num_actions as f32;
            for a in 0..num_actions.min(self.max_actions) {
                strategy[a] = prob;
            }
            log!("[get_average_strategy] UNIFORM FALLBACK! infoset={}, hand={}, num_actions={}, raw_values={:?}",
                 infoset_id, hand_idx, num_actions, raw_values);
        }

        strategy
    }

    /// Create a new trainer initialized with zero regrets.
    pub fn new(num_infosets: usize, max_actions: usize, num_hands: [usize; 2]) -> Self {
        let max_h = num_hands[0].max(num_hands[1]);
        let size = num_infosets * max_h * max_actions;
        let sum_size = num_infosets * max_h;

        Self {
            regrets: vec![0.0; size],
            strategy_sum: vec![0.0; size],
            regret_sum: vec![0.0; sum_size],
            max_actions,
            max_hands: max_h,
            num_hands,
            iterations: 0,
        }
    }

    /// Run CFR iterations with DCFR discounting.
    pub fn train(&mut self, tree: &GameTree, equity_matrix: &[f32], iterations: usize, initial_reach: &[Vec<f32>; 2]) {
        for _ in 0..iterations {
            self.iterations += 1;
            let iter = self.iterations;
            let is_first = iter == 1;

            if is_first {
                log!("[DCFRTrainer::train] First iteration running...");
            }

            // Run CFR traversal (regrets accumulate without discounting in cfr())
            let (u0, u1) = self.cfr(tree, equity_matrix, 0, &initial_reach[0], &initial_reach[1]);

            // Apply DCFR discounting to all regrets and update strategy sum
            self.apply_dcfr_discount(iter);

            if is_first {
                // Log root utility
                let u0_sum: f32 = u0.iter().sum();
                let u1_sum: f32 = u1.iter().sum();
                log!("[DCFRTrainer::train] Root utility - U0 sum: {:.4}, U1 sum: {:.4}", u0_sum, u1_sum);
                if !u0.is_empty() {
                    log!("[DCFRTrainer::train] U0 sample [0..min(3,len)]: {:?}",
                         &u0[0..u0.len().min(3)]);
                }

                // Log first 5 regret values AFTER update
                let regret_sample: Vec<f32> = self.regrets.iter().take(5).cloned().collect();
                log!("[DCFRTrainer::train] First 5 regrets AFTER discount: {:?}", regret_sample);

                // Check if all regrets are zero
                let non_zero_regrets = self.regrets.iter().filter(|&&r| r != 0.0).count();
                log!("[DCFRTrainer::train] Non-zero regrets: {} / {}", non_zero_regrets, self.regrets.len());

                // Also log strategy_sum
                let strat_sample: Vec<f32> = self.strategy_sum.iter().take(5).cloned().collect();
                log!("[DCFRTrainer::train] First 5 strategy_sum AFTER discount: {:?}", strat_sample);
                let non_zero_strat = self.strategy_sum.iter().filter(|&&s| s != 0.0).count();
                log!("[DCFRTrainer::train] Non-zero strategy_sum: {} / {}", non_zero_strat, self.strategy_sum.len());
            }
        }
    }

    /// Apply DCFR discounting to regrets and update strategy sum.
    /// This mirrors TexasSolver's DiscountedCfrTrainable::updateRegrets.
    fn apply_dcfr_discount(&mut self, iteration: usize) {
        let t = iteration as f32;

        // alpha_coef = t^alpha / (1 + t^alpha)
        let alpha_pow = t.powf(ALPHA);
        let alpha_coef = alpha_pow / (1.0 + alpha_pow);

        // strategy_coef = (t / (t+1))^gamma
        let strategy_coef = (t / (t + 1.0)).powf(GAMMA);

        // Reset regret sums
        self.regret_sum.fill(0.0);

        // Apply discounting to all regrets
        for i in 0..self.regrets.len() {
            let r = self.regrets[i];

            // Apply DCFR discount
            if r > 0.0 {
                self.regrets[i] = r * alpha_coef;
            } else {
                self.regrets[i] = r * BETA;
            }
        }

        // Recompute regret sums for regret matching
        let num_infosets = self.regret_sum.len() / self.max_hands;
        for infoset in 0..num_infosets {
            for h in 0..self.max_hands {
                let sum_idx = infoset * self.max_hands + h;
                let base_idx = infoset * self.max_hands * self.max_actions + h * self.max_actions;
                let mut sum = 0.0;
                for a in 0..self.max_actions {
                    let r = self.regrets[base_idx + a];
                    if r > 0.0 {
                        sum += r;
                    }
                }
                self.regret_sum[sum_idx] = sum;
            }
        }

        // Update strategy_sum using DCFR formula:
        // cum_r_plus *= theta
        // cum_r_plus += current_strategy * strategy_coef
        for infoset in 0..num_infosets {
            for h in 0..self.max_hands {
                let sum_idx = infoset * self.max_hands + h;
                let base_idx = infoset * self.max_hands * self.max_actions + h * self.max_actions;
                let r_sum = self.regret_sum[sum_idx];

                for a in 0..self.max_actions {
                    let idx = base_idx + a;

                    // Compute current strategy via regret matching
                    let current_strat = if r_sum > 0.0 {
                        let r = self.regrets[idx];
                        if r > 0.0 { r / r_sum } else { 0.0 }
                    } else {
                        1.0 / self.max_actions as f32
                    };

                    // DCFR strategy accumulation
                    self.strategy_sum[idx] = self.strategy_sum[idx] * THETA + current_strat * strategy_coef;
                }
            }
        }
    }

    /// Recursive CFR function.
    /// Returns (U0, U1) utility vectors.
    fn cfr(
        &mut self,
        tree: &GameTree,
        equity_matrix: &[f32],
        node_idx: u32,
        reach0: &[f32],
        reach1: &[f32],
    ) -> (Vec<f32>, Vec<f32>) {
        let node = tree.get_node(node_idx);
        
        match node.node_type {
            NodeType::Terminal => {
                // Terminal (Fold)
                // node.player contains the winner (opponent of folder)
                //
                // ZERO-SUM PAYOFF:
                // - Winner gains pot/2, Loser loses pot/2
                // - This ensures u0 + u1 = 0 (zero-sum game)
                let winner = node.player;
                let half_pot = node.pot / 2.0;

                let u0_val = if winner == 0 { half_pot } else { -half_pot };
                let u1_val = if winner == 1 { half_pot } else { -half_pot };

                (vec![u0_val; self.num_hands[0]], vec![u1_val; self.num_hands[1]])
            },
            NodeType::Showdown => {
                // Showdown - ZERO-SUM PAYOFF
                //
                // For a zero-sum game:
                // - U0 = (equity - 0.5) * pot (profit/loss relative to fair share)
                // - U1 = -U0 = (0.5 - equity) * pot
                //
                // When equity = 1 (P0 wins): U0 = +pot/2, U1 = -pot/2
                // When equity = 0 (P0 loses): U0 = -pot/2, U1 = +pot/2
                // When equity = 0.5 (tie): U0 = 0, U1 = 0

                let mut u0 = vec![0.0; self.num_hands[0]];
                let mut u1 = vec![0.0; self.num_hands[1]];
                let n0 = self.num_hands[0];
                let n1 = self.num_hands[1];
                let pot = node.pot;

                // Compute U0 - weighted by opponent's reach probabilities
                for h0 in 0..n0 {
                    let mut weighted_equity = 0.0;
                    let mut total_weight = 0.0;

                    for h1 in 0..n1 {
                        let eq = equity_matrix[h0 * n1 + h1];
                        if !eq.is_nan() {
                            weighted_equity += eq * reach1[h1];
                            total_weight += reach1[h1];
                        }
                    }

                    // Zero-sum: (equity - 0.5) * pot
                    if total_weight > 0.0 {
                        let avg_equity = weighted_equity / total_weight;
                        u0[h0] = (avg_equity - 0.5) * pot * total_weight;
                    }
                }

                // Compute U1 - weighted by opponent's reach probabilities
                for h1 in 0..n1 {
                    let mut weighted_equity = 0.0;
                    let mut total_weight = 0.0;

                    for h0 in 0..n0 {
                        let eq = equity_matrix[h0 * n1 + h1];
                        if !eq.is_nan() {
                            // P1 equity = 1 - P0 equity
                            weighted_equity += (1.0 - eq) * reach0[h0];
                            total_weight += reach0[h0];
                        }
                    }

                    // Zero-sum: (equity - 0.5) * pot for P1
                    if total_weight > 0.0 {
                        let avg_equity = weighted_equity / total_weight;
                        u1[h1] = (avg_equity - 0.5) * pot * total_weight;
                    }
                }

                (u0, u1)
            },
            NodeType::Action => {
                let player = node.player as usize;
                let num_actions = node.num_actions as usize;
                let infoset_id = node.infoset_id as usize;
                let n_hands = self.num_hands[player];
                
                // 1. Get Strategy (Regret Matching)
                let mut strategy = vec![0.0; n_hands * num_actions];
                let base_idx = infoset_id * self.max_hands * self.max_actions;
                
                for h in 0..n_hands {
                    let mut sum_pos_regret = 0.0;
                    for a in 0..num_actions {
                        let r = self.regrets[base_idx + h * self.max_actions + a];
                        if r > 0.0 {
                            sum_pos_regret += r;
                        }
                    }
                    
                    for a in 0..num_actions {
                        let idx = h * num_actions + a;
                        if sum_pos_regret > 0.0 {
                            let r = self.regrets[base_idx + h * self.max_actions + a];
                            strategy[idx] = if r > 0.0 { r / sum_pos_regret } else { 0.0 };
                        } else {
                            strategy[idx] = 1.0 / num_actions as f32;
                        }
                    }
                }
                
                // 2. Recurse
                let mut u0_node = vec![0.0; self.num_hands[0]];
                let mut u1_node = vec![0.0; self.num_hands[1]];
                
                // Store child utilities for active player to update regrets
                // [action][hand]
                let mut active_child_utils = Vec::with_capacity(num_actions);
                
                let children_start = node.children_start;
                
                for a in 0..num_actions {
                    let child_idx = children_start + a as u32;
                    
                    // Update reach probs
                    let mut next_reach0 = reach0.to_vec();
                    let mut next_reach1 = reach1.to_vec();
                    
                    if player == 0 {
                        for h in 0..n_hands {
                            next_reach0[h] *= strategy[h * num_actions + a];
                        }
                    } else {
                        for h in 0..n_hands {
                            next_reach1[h] *= strategy[h * num_actions + a];
                        }
                    }
                    
                    let (u0_child, u1_child) = self.cfr(tree, equity_matrix, child_idx, &next_reach0, &next_reach1);
                    
                    // Accumulate node utilities
                    if player == 0 {
                        // P0 is active
                        // U0[h] += sigma[h][a] * U0_child[h]
                        for h in 0..self.num_hands[0] {
                            u0_node[h] += strategy[h * num_actions + a] * u0_child[h];
                        }
                        // U1[h] += U1_child[h] (sum over actions)
                        for h in 0..self.num_hands[1] {
                            u1_node[h] += u1_child[h];
                        }
                        active_child_utils.push(u0_child);
                    } else {
                        // P1 is active
                        // U1[h] += sigma[h][a] * U1_child[h]
                        for h in 0..self.num_hands[1] {
                            u1_node[h] += strategy[h * num_actions + a] * u1_child[h];
                        }
                        // U0[h] += U0_child[h]
                        for h in 0..self.num_hands[0] {
                            u0_node[h] += u0_child[h];
                        }
                        active_child_utils.push(u1_child);
                    }
                }
                
                // 3. Update Regrets (for active player)
                // Strategy sum is updated in apply_dcfr_discount() after full traversal
                let node_util = if player == 0 { &u0_node } else { &u1_node };

                for h in 0..n_hands {
                    for a in 0..num_actions {
                        let regret = active_child_utils[a][h] - node_util[h];
                        let idx = base_idx + h * self.max_actions + a;

                        // Accumulate raw regret (discounting applied after iteration)
                        self.regrets[idx] += regret;
                    }
                }

                (u0_node, u1_node)
            },
            NodeType::Chance => (vec![], vec![]), // Should not happen in River subgame builder
        }
    }
}
