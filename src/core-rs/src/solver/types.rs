//! Common types for the solver.

use serde::{Deserialize, Serialize};

/// Configuration for building the game tree.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameConfig {
    /// Initial pot size at the start of the street.
    pub initial_pot: f32,
    /// Player stacks (remaining chips).
    pub stacks: [f32; 2],
    /// Available bet sizes (as fraction of pot, e.g., 0.5, 1.0).
    pub bet_sizes: Vec<f32>,
    /// Available raise sizes (as fraction of pot).
    pub raise_sizes: Vec<f32>,
    /// Maximum number of raises allowed per street (default: 3).
    /// Set to 0 to disable raises entirely.
    #[serde(default = "default_raise_limit")]
    pub raise_limit: u8,
}

fn default_raise_limit() -> u8 {
    3 // Default: allow up to 3 raises
}

/// Type of action taken by a player.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ActionType {
    Fold,
    Check,
    Call,
    Bet,
    Raise,
}

impl ActionType {
    pub fn is_aggressive(&self) -> bool {
        matches!(self, ActionType::Bet | ActionType::Raise)
    }
}
