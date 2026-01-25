use wasm_bindgen::prelude::*;

// Poker primitives module
pub mod poker;
pub mod solver;

// Re-export poker types and WASM functions
pub use poker::Card;
pub use poker::card::{parse_card, card_to_string, card_bitmask, card_rank, card_suit};
pub use poker::evaluator::{evaluate_7_cards, evaluate_5_cards, get_hand_rank_name, init_lookup_tables};
pub use poker::equity::{compute_equity_matrix, compute_single_equity};

use solver::{GameConfig, build_river_tree, DCFRTrainer, GameTree};
use solver::types::ActionType;
use serde_json::json;

/// Initialize panic hook for better error messages in browser console.
/// This should be called once at startup.
fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
    
    // Always set the hook in debug builds
    #[cfg(debug_assertions)]
    console_error_panic_hook::set_once();
}

/// Macro for convenient console logging using web-sys
macro_rules! log {
    ($($t:tt)*) => (web_sys::console::log_1(&format!($($t)*).into()))
}

/// Re-export the macro for use in submodules
pub(crate) use log;

/// Initialize the Rust core module and lookup tables.
/// Returns Ok(()) on success, or a JsValue error on failure.
#[wasm_bindgen]
pub fn init() -> Result<(), JsValue> {
    init_panic_hook();
    init_lookup_tables();
    log!("🦀 Rust Core Initialized (with lookup tables)");
    Ok(())
}

/// Simple greet function to verify the toolchain works.
#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Poker Solver Rust Core is ready.", name)
}

/// Returns the version of the Rust core module.
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// ============================================================================
// WASM EXPORTS FOR EVALUATOR
// ============================================================================

/// Test hand evaluation from JS.
/// Accepts a space-separated string of card codes (e.g., "As Kh Qd Jc Ts 2h 3c")
/// Returns the hand score (lower = better, 1 = royal flush)
#[wasm_bindgen]
pub fn test_evaluation(cards_str: &str) -> u16 {
    let cards: Vec<Card> = cards_str
        .split_whitespace()
        .filter_map(|s| Card::from_str(s))
        .collect();
    
    if cards.len() < 5 {
        return 7462; // Worst possible
    }
    
    evaluate_7_cards(&cards)
}

/// Get the hand rank name from a score
#[wasm_bindgen]
pub fn get_hand_name(score: u16) -> String {
    get_hand_rank_name(score).to_string()
}

/// Evaluate a single hand comparison on a board
/// Returns 1.0 (win), 0.0 (loss), 0.5 (tie), or -1.0 (blocked/impossible)
#[wasm_bindgen]
pub fn evaluate_matchup(board_str: &str, hand1_str: &str, hand2_str: &str) -> f32 {
    let board: Vec<Card> = board_str.split_whitespace().filter_map(|s| Card::from_str(s)).collect();
    let hand1: Vec<Card> = hand1_str.split_whitespace().filter_map(|s| Card::from_str(s)).collect();
    let hand2: Vec<Card> = hand2_str.split_whitespace().filter_map(|s| Card::from_str(s)).collect();
    
    match compute_single_equity(&board, &hand1, &hand2) {
        Some(eq) => eq,
        None => -1.0, // Blocked
    }
}

/// Build a test tree and return stats as JSON string.
///
/// # Arguments
/// * `initial_pot` - Pot size at start of river
/// * `stack` - Effective stack size (for both players)
#[wasm_bindgen]
pub fn test_tree_build(initial_pot: f32, stack: f32) -> String {
    let config = GameConfig {
        initial_pot,
        stacks: [stack, stack],
        bet_sizes: vec![0.5, 1.0], // 50% and 100% pot bets
        raise_sizes: vec![1.0],    // 100% pot raises
        raise_limit: 3,            // Allow up to 3 raises
    };

    let tree = build_river_tree(&config);

    let stats = json!({
        "nodes": tree.nodes.len(),
        "infosets": tree.infoset_map.len(),
        "root_pot": tree.nodes[0].pot,
        "config": config
    });

    stats.to_string()
}



#[wasm_bindgen]
pub struct SolverSession {
    tree: GameTree,
    trainer: DCFRTrainer,
    equity_matrix: Vec<f32>,
    initial_reach: [Vec<f32>; 2],
    ranges: [Vec<Vec<Card>>; 2],
}

#[wasm_bindgen]
impl SolverSession {
    #[wasm_bindgen(constructor)]
    pub fn new(config_json: &str, board_str: &str, range0_str: &str, range1_str: &str) -> Result<SolverSession, JsValue> {
        log!("[SolverSession::new] Init session...");

        // 1. Parse Config
        let config: GameConfig = serde_json::from_str(config_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid config: {}", e)))?;
        log!("[SolverSession::new] Config parsed: pot={}, stacks={:?}", config.initial_pot, config.stacks);

        // 2. Parse Board
        let board: Vec<Card> = board_str.split_whitespace()
            .filter_map(|s| Card::from_str(s))
            .collect();
        if board.len() != 5 {
             return Err(JsValue::from_str("Board must have 5 cards"));
        }
        // Log board as integer values to verify they aren't 0
        let board_ints: Vec<u8> = board.iter().map(|c| c.index()).collect();
        log!("[SolverSession::new] Board parsed: {:?} (ints: {:?})", board_str, board_ints);

        // 3. Parse Ranges
        let parse_range = |s: &str| -> Vec<Vec<Card>> {
            s.split(',')
             .map(|hand_str| {
                 hand_str.split_whitespace()
                         .filter_map(|cs| Card::from_str(cs))
                         .collect::<Vec<Card>>()
             })
             .filter(|h| h.len() == 2)
             .collect()
        };

        let range0 = parse_range(range0_str);
        let range1 = parse_range(range1_str);

        if range0.is_empty() || range1.is_empty() {
            return Err(JsValue::from_str("Ranges cannot be empty"));
        }
        log!("[SolverSession::new] Ranges: P0={} hands, P1={} hands", range0.len(), range1.len());

        // 4. Compute Equity Matrix
        let equity_matrix = compute_equity_matrix(&board, &range0, &range1);
        log!("[SolverSession::new] Equity Matrix size: {} (expected {}x{}={})",
             equity_matrix.len(), range0.len(), range1.len(), range0.len() * range1.len());
        // Log first few equity values
        if equity_matrix.len() >= 3 {
            log!("[SolverSession::new] Equity sample [0..3]: [{:.3}, {:.3}, {:.3}]",
                 equity_matrix[0], equity_matrix[1], equity_matrix[2]);
        }

        // 5. Build Tree
        let tree = build_river_tree(&config);
        log!("[SolverSession::new] Tree built. Nodes: {}, Infosets: {}",
             tree.nodes.len(), tree.infoset_map.len());

        // 6. Initialize Trainer
        let num_infosets = tree.infoset_map.len();
        let max_actions = tree.nodes.iter().map(|n| n.num_actions as usize).max().unwrap_or(0);
        let num_hands = [range0.len(), range1.len()];

        let trainer = DCFRTrainer::new(num_infosets, max_actions, num_hands);
        log!("[SolverSession::new] Trainer created. regrets.len={}, strategy_sum.len={}, max_actions={}",
             trainer.regrets.len(), trainer.strategy_sum.len(), max_actions);

        // 7. Initial Reach
        let initial_reach = [vec![1.0; num_hands[0]], vec![1.0; num_hands[1]]];

        log!("[SolverSession::new] Session ready!");
        Ok(SolverSession {
            tree,
            trainer,
            equity_matrix,
            initial_reach,
            ranges: [range0, range1],
        })
    }
    
    pub fn step(&mut self, iterations: usize) {
        self.trainer.train(&self.tree, &self.equity_matrix, iterations, &self.initial_reach);
    }
    
    pub fn get_stats(&self) -> String {
        json!({
            "iterations": self.trainer.iterations,
            "nodes": self.tree.nodes.len(),
            "infosets": self.tree.infoset_map.len()
        }).to_string()
    }

    pub fn get_strategy_ptr(&self) -> *const f32 {
        let ptr = self.trainer.strategy_sum.as_ptr();
        let len = self.trainer.strategy_sum.len();
        log!("[get_strategy_ptr] Returning ptr: {:p}, len: {}", ptr, len);

        // Print first 3 floats to prove Rust has data
        if len >= 3 {
            log!("[get_strategy_ptr] First 3 floats: [{:.6}, {:.6}, {:.6}]",
                 self.trainer.strategy_sum[0],
                 self.trainer.strategy_sum[1],
                 self.trainer.strategy_sum[2]);
        }

        // Also check if any values are non-zero
        let non_zero_count = self.trainer.strategy_sum.iter().filter(|&&x| x != 0.0).count();
        log!("[get_strategy_ptr] Non-zero values: {} / {}", non_zero_count, len);

        ptr
    }

    pub fn get_strategy_len(&self) -> usize {
        self.trainer.strategy_sum.len()
    }

    pub fn get_num_actions(&self) -> usize {
        self.trainer.max_actions()
    }
    
    /// Get available actions at the root node as JSON.
    /// Returns [{ "type": "check", "amount": 0 }, { "type": "bet", "amount": 75 }, ...]
    /// This is used by the UI to display action buttons with correct amounts.
    pub fn get_node_actions(&self) -> String {
        let node_id: u32 = 0; // Root node
        let node = &self.tree.nodes[node_id as usize];

        let mut actions = Vec::new();

        for i in 0..node.num_actions {
            let child_id = node.children_start + i as u32;
            let child = &self.tree.nodes[child_id as usize];

            if let Some(action_type) = child.action_from_parent {
                let type_str = match action_type {
                    ActionType::Fold => "fold",
                    ActionType::Check => "check",
                    ActionType::Call => "call",
                    ActionType::Bet => "bet",
                    ActionType::Raise => "raise",
                };

                actions.push(json!({
                    "type": type_str,
                    "amount": child.amount_from_parent
                }));
            }
        }

        serde_json::to_string(&actions).unwrap_or_else(|_| "[]".to_string())
    }

    /// Get strategy for a specific hand (e.g., "As Kh") as JSON.
    /// Returns { "actions": ["check", "bet"], "probs": [0.5, 0.5] }
    pub fn get_hand_strategy(&self, hand_str: &str) -> Result<String, JsValue> {
        let cards: Vec<Card> = hand_str.split_whitespace()
            .filter_map(|s| Card::from_str(s))
            .collect();
            
        if cards.len() != 2 {
            return Err(JsValue::from_str("Hand must have 2 cards"));
        }
        
        // Find player and hand index
        let mut player = 0;
        let mut hand_idx = None;
        
        // Check range 0
        for (i, h) in self.ranges[0].iter().enumerate() {
            if h[0] == cards[0] && h[1] == cards[1] || h[0] == cards[1] && h[1] == cards[0] {
                hand_idx = Some(i);
                player = 0;
                break;
            }
        }
        
        // Check range 1
        if hand_idx.is_none() {
            for (i, h) in self.ranges[1].iter().enumerate() {
                if h[0] == cards[0] && h[1] == cards[1] || h[0] == cards[1] && h[1] == cards[0] {
                    hand_idx = Some(i);
                    player = 1;
                    break;
                }
            }
        }
        
        let hand_idx = hand_idx.ok_or_else(|| JsValue::from_str("Hand not found in ranges"))?;
        
        // Find node
        let node_id = if player == 0 {
            0 // Root
        } else {
            // Find child of root that is ActionType::Check
            // Root is P0. Children are P0's actions.
            // We need the node where P0 checked.
            // That node is where P1 acts.
            let root = &self.tree.nodes[0];
            let mut target_id = None;
            for i in 0..root.num_actions {
                let child_id = root.children_start + i as u32;
                let child = &self.tree.nodes[child_id as usize];
                // The child node represents the state AFTER P0's action.
                // If P0 checked, child.action_from_parent == Check.
                // And child.player should be 1 (P1).
                if let Some(ActionType::Check) = child.action_from_parent {
                    target_id = Some(child_id);
                    break;
                }
            }
            target_id.ok_or_else(|| JsValue::from_str("No check action found for P0"))?
        };
        
        let node = &self.tree.nodes[node_id as usize];
        if node.infoset_id == u32::MAX {
             return Err(JsValue::from_str("Node has no infoset"));
        }
        
        let strategy = self.trainer.get_average_strategy_with_actions(
            node.infoset_id as usize,
            hand_idx,
            node.num_actions as usize
        );

        // Get action names
        let mut actions = Vec::new();
        for i in 0..node.num_actions {
            let child_id = node.children_start + i as u32;
            let child = &self.tree.nodes[child_id as usize];
            if let Some(action_type) = child.action_from_parent {
                let mut name = format!("{:?}", action_type).to_lowercase();
                if action_type == ActionType::Bet || action_type == ActionType::Raise {
                    name = format!("{} {:.1}", name, child.amount_from_parent);
                }
                actions.push(name);
            } else {
                actions.push("unknown".to_string());
            }
        }
        
        // Filter strategy to match num_actions
        let probs = &strategy[0..node.num_actions as usize];

        Ok(json!({
            "actions": actions,
            "probs": probs
        }).to_string())
    }

    /// Get the node index for a given action history.
    /// history_actions_js should be a JS array of action strings, e.g., ["check", "bet 75"]
    /// Returns the node index, or an error if the path is invalid.
    #[wasm_bindgen]
    pub fn get_strategy_for_history(&self, history_actions_js: JsValue) -> Result<String, JsValue> {
        // Parse JS array into Vec<String>
        let history: Vec<String> = serde_wasm_bindgen::from_value(history_actions_js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse history: {}", e)))?;

        log!("[get_strategy_for_history] History: {:?}", history);

        // Start at root node
        let mut node_idx: usize = 0;

        // Traverse the tree following the action history
        for action_str in &history {
            let current_node = &self.tree.nodes[node_idx];

            // Parse the action string into ActionType and optional amount
            let (target_action, target_amount) = Self::parse_action_string(action_str);

            log!("[get_strategy_for_history] At node {} (player={}), looking for action {:?} (amount: {:?}). Available: {}",
                 node_idx, current_node.player, target_action, target_amount,
                 self.get_available_actions_at_node(node_idx));

            // Find the matching child
            let mut found_child: Option<usize> = None;
            let mut best_amount_match: Option<(usize, f32)> = None; // (child_idx, amount_diff)

            for i in 0..current_node.num_actions {
                let child_idx = (current_node.children_start + i as u32) as usize;
                let child = &self.tree.nodes[child_idx];

                if let Some(child_action) = child.action_from_parent {
                    log!("[get_strategy_for_history]   Child {}: {:?} amount={}",
                         child_idx, child_action, child.amount_from_parent);

                    if child_action == target_action {
                        // For bet/raise, we may need to match amount
                        if target_action == ActionType::Bet || target_action == ActionType::Raise {
                            if let Some(target_amt) = target_amount {
                                // Match by closest amount (with 10% tolerance for rounding)
                                let diff = (child.amount_from_parent - target_amt).abs();
                                let tolerance = target_amt * 0.15; // 15% tolerance

                                log!("[get_strategy_for_history]     Bet/Raise match: child_amt={}, target_amt={}, diff={}, tolerance={}",
                                     child.amount_from_parent, target_amt, diff, tolerance);

                                if best_amount_match.is_none() || diff < best_amount_match.unwrap().1 {
                                    best_amount_match = Some((child_idx, diff));
                                }
                            } else {
                                // No amount specified - take first matching action type
                                if found_child.is_none() {
                                    found_child = Some(child_idx);
                                }
                            }
                        } else {
                            // Non-bet/raise action: exact match
                            found_child = Some(child_idx);
                            break;
                        }
                    }
                }
            }

            // Use amount match if available for bet/raise
            if found_child.is_none() {
                if let Some((child_idx, diff)) = best_amount_match {
                    log!("[get_strategy_for_history] Using best amount match: child {} with diff {}", child_idx, diff);
                    found_child = Some(child_idx);
                }
            }

            match found_child {
                Some(child_idx) => {
                    let child = &self.tree.nodes[child_idx];
                    log!("[get_strategy_for_history] Found child at index {}, next player={}",
                         child_idx, child.player);
                    node_idx = child_idx;
                }
                None => {
                    return Err(JsValue::from_str(&format!(
                        "Action '{}' not found at node {} (player={}). Available actions: {}",
                        action_str, node_idx, current_node.player, self.get_available_actions_at_node(node_idx)
                    )));
                }
            }
        }

        // Now we're at the target node
        let target_node = &self.tree.nodes[node_idx];
        log!("[get_strategy_for_history] Reached target node {}. Player: {}, infoset_id: {}, num_actions: {}",
             node_idx, target_node.player, target_node.infoset_id, target_node.num_actions);

        // Check if this is a terminal node or has no infoset
        if target_node.infoset_id == u32::MAX {
            // Terminal node or opponent node without infoset
            return Ok(json!({
                "nodeIdx": node_idx,
                "isTerminal": target_node.num_actions == 0,
                "player": target_node.player,
                "pot": target_node.pot,
                "actions": [],
                "strategy": null,
                "message": "Node has no infoset (terminal or opponent's decision point)"
            }).to_string());
        }

        // Get the available actions at this node
        let actions = self.get_actions_at_node(node_idx);

        // Return node info and infoset data
        Ok(json!({
            "nodeIdx": node_idx,
            "isTerminal": false,
            "player": target_node.player,
            "pot": target_node.pot,
            "infosetId": target_node.infoset_id,
            "numActions": target_node.num_actions,
            "actions": actions
        }).to_string())
    }

    /// Get strategy for a specific hand at a specific node (reached via history).
    /// hand_str: e.g., "As Kh"
    /// node_idx: the node index (obtained from get_strategy_for_history)
    #[wasm_bindgen]
    pub fn get_hand_strategy_at_node(&self, hand_str: &str, node_idx: usize) -> Result<String, JsValue> {
        // Parse hand
        let cards: Vec<Card> = hand_str.split_whitespace()
            .filter_map(|s| Card::from_str(s))
            .collect();

        if cards.len() != 2 {
            return Err(JsValue::from_str("Hand must have 2 cards"));
        }

        // Get the node
        if node_idx >= self.tree.nodes.len() {
            return Err(JsValue::from_str("Invalid node index"));
        }

        let node = &self.tree.nodes[node_idx];

        // Check if it's a terminal node
        if node.num_actions == 0 {
            return Err(JsValue::from_str("Cannot get strategy at terminal node"));
        }

        // Check if it has an infoset
        if node.infoset_id == u32::MAX {
            return Err(JsValue::from_str("Node has no infoset"));
        }

        // Determine which player acts at this node
        let acting_player = node.player as usize;

        // Find hand index in the acting player's range
        let mut hand_idx = None;
        for (i, h) in self.ranges[acting_player].iter().enumerate() {
            if (h[0] == cards[0] && h[1] == cards[1]) || (h[0] == cards[1] && h[1] == cards[0]) {
                hand_idx = Some(i);
                break;
            }
        }

        let hand_idx = hand_idx.ok_or_else(||
            JsValue::from_str(&format!("Hand not found in player {}'s range", acting_player)))?;

        // Get the strategy with correct number of actions
        let strategy = self.trainer.get_average_strategy_with_actions(
            node.infoset_id as usize,
            hand_idx,
            node.num_actions as usize
        );

        // Get action names
        let actions = self.get_actions_at_node(node_idx);

        // Filter strategy to match num_actions
        let probs = &strategy[0..node.num_actions as usize];

        Ok(json!({
            "player": acting_player,
            "handIdx": hand_idx,
            "actions": actions,
            "probs": probs
        }).to_string())
    }

    /// Get actions at a specific node as JSON array
    #[wasm_bindgen]
    pub fn get_node_actions_at(&self, node_idx: usize) -> String {
        if node_idx >= self.tree.nodes.len() {
            return "[]".to_string();
        }
        serde_json::to_string(&self.get_actions_at_node(node_idx)).unwrap_or_else(|_| "[]".to_string())
    }

    // ========================================================================
    // HELPER METHODS (not exposed to WASM)
    // ========================================================================

    /// Parse an action string like "check", "bet", "bet 75", "raise 150" into ActionType and optional amount
    fn parse_action_string(action_str: &str) -> (ActionType, Option<f32>) {
        let parts: Vec<&str> = action_str.trim().split_whitespace().collect();

        if parts.is_empty() {
            return (ActionType::Check, None); // Default fallback
        }

        let action_type = match parts[0].to_lowercase().as_str() {
            "fold" => ActionType::Fold,
            "check" => ActionType::Check,
            "call" => ActionType::Call,
            "bet" => ActionType::Bet,
            "raise" => ActionType::Raise,
            _ => ActionType::Check, // Default fallback
        };

        // Parse amount if present
        let amount = if parts.len() > 1 {
            parts[1].parse::<f32>().ok()
        } else {
            None
        };

        (action_type, amount)
    }

    /// Get available actions at a node as a comma-separated string (for error messages)
    fn get_available_actions_at_node(&self, node_idx: usize) -> String {
        let node = &self.tree.nodes[node_idx];
        let mut actions = Vec::new();

        for i in 0..node.num_actions {
            let child_idx = (node.children_start + i as u32) as usize;
            let child = &self.tree.nodes[child_idx];

            if let Some(action_type) = child.action_from_parent {
                let name = match action_type {
                    ActionType::Fold => "fold".to_string(),
                    ActionType::Check => "check".to_string(),
                    ActionType::Call => "call".to_string(),
                    ActionType::Bet => format!("bet {:.0}", child.amount_from_parent),
                    ActionType::Raise => format!("raise {:.0}", child.amount_from_parent),
                };
                actions.push(name);
            }
        }

        actions.join(", ")
    }

    /// Get actions at a node as a vector of JSON objects
    fn get_actions_at_node(&self, node_idx: usize) -> Vec<serde_json::Value> {
        let node = &self.tree.nodes[node_idx];
        let mut actions = Vec::new();

        for i in 0..node.num_actions {
            let child_idx = (node.children_start + i as u32) as usize;
            let child = &self.tree.nodes[child_idx];

            if let Some(action_type) = child.action_from_parent {
                let type_str = match action_type {
                    ActionType::Fold => "fold",
                    ActionType::Check => "check",
                    ActionType::Call => "call",
                    ActionType::Bet => "bet",
                    ActionType::Raise => "raise",
                };

                actions.push(json!({
                    "type": type_str,
                    "amount": child.amount_from_parent
                }));
            }
        }

        actions
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet() {
        let result = greet("World");
        assert!(result.contains("Hello, World!"));
    }

    #[test]
    fn test_version() {
        let v = version();
        assert!(!v.is_empty());
    }

    #[test]
    fn test_evaluation_wasm() {
        let score = test_evaluation("As Ks Qs Js Ts");
        assert_eq!(score, 1, "Royal flush should be 1");
    }

    #[test]
    fn test_hand_name() {
        assert_eq!(get_hand_name(1), "Royal Flush");
        assert_eq!(get_hand_name(5), "Straight Flush");
        assert_eq!(get_hand_name(100), "Four of a Kind");
        assert_eq!(get_hand_name(200), "Full House");
    }
}
