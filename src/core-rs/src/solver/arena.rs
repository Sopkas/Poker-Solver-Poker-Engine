//! Arena-based memory model for the game tree.
//! 
//! Uses a flat vector to store nodes, improving cache locality and avoiding
//! pointer chasing. Nodes use u32 indices to reference children.

use std::collections::HashMap;
use serde::{Serialize, Deserialize};
use crate::solver::types::ActionType;

/// Type of node in the game tree.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NodeType {
    /// Terminal node (game over, money exchanged).
    Terminal,
    /// Showdown node (game over, hands compared).
    Showdown,
    /// Action node (player must act).
    Action,
    /// Chance node (random event, e.g., dealing cards).
    /// Note: For river subgames, chance nodes are usually implicit or pre-resolved.
    Chance,
}

/// A node in the game tree.
/// 
/// Designed to be compact (fits in cache line if possible).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    /// Type of the node.
    pub node_type: NodeType,
    /// Player whose turn it is (0 or 1), or 255 if terminal/showdown.
    pub player: u8,
    /// Current size of the pot.
    pub pot: f32,
    /// Index of the first child in the arena.
    pub children_start: u32,
    /// Number of available actions/children.
    pub num_actions: u8,
    /// ID of the information set this node belongs to.
    /// u32::MAX if not applicable (e.g., terminal).
    pub infoset_id: u32,
    /// The action that led to this node (for visualization/debugging).
    pub action_from_parent: Option<ActionType>,
    /// The amount associated with the action (e.g., bet amount).
    pub amount_from_parent: f32,
}

impl Node {
    pub fn new(node_type: NodeType, player: u8, pot: f32) -> Self {
        Self {
            node_type,
            player,
            pot,
            children_start: 0,
            num_actions: 0,
            infoset_id: u32::MAX,
            action_from_parent: None,
            amount_from_parent: 0.0,
        }
    }

    pub fn is_terminal(&self) -> bool {
        matches!(self.node_type, NodeType::Terminal | NodeType::Showdown)
    }
}

/// The Game Tree container.
#[derive(Debug, Serialize, Deserialize)]
pub struct GameTree {
    /// Flat storage for all nodes.
    pub nodes: Vec<Node>,
    /// Map from canonical infoset hash to infoset ID.
    pub infoset_map: HashMap<u64, u32>,
}

impl GameTree {
    pub fn new() -> Self {
        Self {
            nodes: Vec::with_capacity(10000), // Pre-allocate reasonable size
            infoset_map: HashMap::new(),
        }
    }

    /// Add a node to the arena and return its index.
    pub fn add_node(&mut self, node: Node) -> u32 {
        let id = self.nodes.len() as u32;
        self.nodes.push(node);
        id
    }

    /// Get a reference to a node by index.
    pub fn get_node(&self, id: u32) -> &Node {
        &self.nodes[id as usize]
    }

    /// Get a mutable reference to a node by index.
    pub fn get_node_mut(&mut self, id: u32) -> &mut Node {
        &mut self.nodes[id as usize]
    }

    /// Get or create an infoset ID for a given key.
    pub fn get_infoset_id(&mut self, key: u64) -> u32 {
        if let Some(&id) = self.infoset_map.get(&key) {
            id
        } else {
            let id = self.infoset_map.len() as u32;
            self.infoset_map.insert(key, id);
            id
        }
    }
}
