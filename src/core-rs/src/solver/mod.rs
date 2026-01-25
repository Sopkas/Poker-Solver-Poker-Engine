//! Solver module containing the game tree, CFR algorithm, and tree builder.

pub mod arena;
pub mod builder;
pub mod types;
pub mod dcfr;

pub use arena::{GameTree, Node, NodeType};
pub use builder::build_river_tree;
pub use types::{GameConfig, ActionType};
pub use dcfr::DCFRTrainer;
