//! Poker primitives module
//! Contains Card, Hand Evaluator, and Equity computation for the poker solver core.

pub mod card;
pub mod evaluator;
pub mod equity;

pub use card::Card;
pub use evaluator::{evaluate_7_cards, evaluate_5_cards, HandRank, get_hand_rank_name};
pub use equity::compute_equity_matrix;
