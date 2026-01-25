//! Recursive tree builder for River subgames.

use crate::solver::arena::{GameTree, Node, NodeType};
use crate::solver::types::{GameConfig, ActionType};

/// Build the game tree for a River subgame.
pub fn build_river_tree(config: &GameConfig) -> GameTree {
    let mut tree = GameTree::new();

    // Calculate initial facing bet (if any)
    // For simplicity in this phase, we assume start of river with no pending bets unless specified
    // But typically solver starts with 0 bets on new street.
    // If we want to support mid-street solving, we'd need more state in config.
    // Here we assume standard river start: pot is set, bets are 0.

    let root_node = Node::new(NodeType::Action, 0, config.initial_pot); // Player 0 starts (OOP)
    let root_id = tree.add_node(root_node);

    // Recursive build
    build_subtree(
        &mut tree,
        root_id,
        config,
        0, // current player
        [0.0, 0.0], // current bets
        config.stacks, // current stacks
        0, // recursion depth (for safety)
        0  // raise count (for raise_limit)
    );

    tree
}

/// Recursive function to build the tree.
fn build_subtree(
    tree: &mut GameTree,
    node_id: u32,
    config: &GameConfig,
    player: u8,
    bets: [f32; 2],
    stacks: [f32; 2],
    depth: u32,
    raise_count: u8, // Track number of raises for raise_limit
) {
    if depth > 20 {
        // Safety break for infinite recursion
        return;
    }

    let opponent = 1 - player;
    let current_pot = config.initial_pot + bets[0] + bets[1];
    let facing_bet = bets[opponent as usize] - bets[player as usize];

    // 1. Identify valid actions
    let mut actions: Vec<(ActionType, f32)> = Vec::new();

    // FOLD
    if facing_bet > 0.0 {
        actions.push((ActionType::Fold, 0.0));
    }

    // CHECK / CALL
    if facing_bet == 0.0 {
        actions.push((ActionType::Check, 0.0));
    } else {
        // Call amount is min(facing_bet, stack)
        let call_amount = facing_bet.min(stacks[player as usize]);
        actions.push((ActionType::Call, call_amount));
    }

    // BET / RAISE
    // Only if not facing all-in and have chips
    // Also check raise_limit for raises (not for initial bets)
    let is_raise = facing_bet > 0.0;
    let can_raise = !is_raise || raise_count < config.raise_limit;
    let can_bet = stacks[player as usize] > facing_bet
        && stacks[opponent as usize] > 0.0
        && can_raise;

    if can_bet {
        // Determine sizes
        let sizes = if facing_bet == 0.0 { &config.bet_sizes } else { &config.raise_sizes };
        
        for &size_pct in sizes {
            let mut amount = if facing_bet == 0.0 {
                // Bet: % of pot
                current_pot * size_pct
            } else {
                // Raise: (call + raise_amt) where raise_amt is % of pot after call
                // Standard geometric sizing often uses (pot + 2*bet) * pct
                // Here we use simple pot fraction for the raise part
                let pot_after_call = current_pot + facing_bet;
                facing_bet + (pot_after_call * size_pct)
            };
            
            // Cap at stack (All-in)
            if amount >= stacks[player as usize] {
                amount = stacks[player as usize];
            }
            
            // Ensure min-raise (unless all-in)
            // Min raise is usually 2x the previous bet or 1BB
            // Simplified: just ensure it's greater than call
            if amount <= facing_bet {
                continue; 
            }
            
            // Avoid duplicate all-ins
            let is_all_in = amount == stacks[player as usize];
            let already_have_all_in = actions.iter().any(|(t, a)| t.is_aggressive() && *a == stacks[player as usize]);
            
            if is_all_in && already_have_all_in {
                continue;
            }
            
            let action_type = if facing_bet == 0.0 { ActionType::Bet } else { ActionType::Raise };
            actions.push((action_type, amount));
        }
        
        // Always add All-in if not covered by sizes
        let all_in_amount = stacks[player as usize];
        let already_have_all_in = actions.iter().any(|(t, a)| t.is_aggressive() && *a == all_in_amount);
        if !already_have_all_in && all_in_amount > facing_bet {
             let action_type = if facing_bet == 0.0 { ActionType::Bet } else { ActionType::Raise };
             actions.push((action_type, all_in_amount));
        }
    }
    
    // 2. Update current node
    let num_actions = actions.len() as u8;
    
    // Generate infoset ID
    // Key: (player << 60) | hash(history)
    // Simple history hash: sum of (action_type * depth) or similar
    // For now, we just use a placeholder unique ID generation strategy would be needed for real solver
    // We'll use a simple counter for unique paths in this builder for now, 
    // but in reality we need to map equivalent histories to same infoset.
    // Since this is a tree builder, we are visiting unique history nodes.
    // So we just assign a new infoset ID for this node.
    // Optimization: In a real solver, we'd hash the betting sequence.
    let infoset_key = (player as u64) << 60 | (node_id as u64); 
    let infoset_id = tree.get_infoset_id(infoset_key);
    
    let children_start = tree.nodes.len() as u32;
    
    {
        let node = tree.get_node_mut(node_id);
        node.num_actions = num_actions;
        node.children_start = children_start; // Children will be appended next
        node.infoset_id = infoset_id;
    }
    
    // 3. Create children
    // We must collect children indices to recurse on them, to avoid borrowing issues
    let mut children_configs = Vec::new();

    for (action_type, amount) in actions {
        let mut next_node = Node::new(NodeType::Action, opponent, current_pot); // Default, updated below
        next_node.action_from_parent = Some(action_type);
        next_node.amount_from_parent = amount;

        let mut next_bets = bets;
        let mut next_stacks = stacks;
        let mut is_terminal = false;
        let mut is_showdown = false;
        let mut next_raise_count = raise_count;

        match action_type {
            ActionType::Fold => {
                next_node.node_type = NodeType::Terminal;
                next_node.player = opponent; // Winner of the pot
                next_node.pot = current_pot; // Pot doesn't increase on fold
                is_terminal = true;
            },
            ActionType::Check => {
                if player == 1 { // IP checked back
                    next_node.node_type = NodeType::Showdown;
                    next_node.player = 255;
                    is_showdown = true;
                } else {
                    // OOP checked, now IP acts
                    next_node.node_type = NodeType::Action;
                    next_node.player = 1;
                }
                // Check resets raise count (new betting round within street)
                next_raise_count = 0;
            },
            ActionType::Call => {
                next_bets[player as usize] += amount;
                next_stacks[player as usize] -= amount;
                next_node.pot = config.initial_pot + next_bets[0] + next_bets[1];

                // Call ends the betting round?
                // If closing action (IP calls or OOP calls raise)
                // And we are on River, so round end = Showdown
                next_node.node_type = NodeType::Showdown;
                next_node.player = 255;
                is_showdown = true;
            },
            ActionType::Bet | ActionType::Raise => {
                next_bets[player as usize] += amount;
                next_stacks[player as usize] -= amount;
                next_node.pot = config.initial_pot + next_bets[0] + next_bets[1];

                // Action passes to opponent
                next_node.node_type = NodeType::Action;
                next_node.player = opponent;

                // Increment raise count for bet/raise actions
                next_raise_count = raise_count + 1;
            }
        }

        let child_id = tree.add_node(next_node);

        if !is_terminal && !is_showdown {
            children_configs.push((child_id, opponent, next_bets, next_stacks, next_raise_count));
        }
    }
    
    // 4. Recurse
    for (child_id, next_player, next_bets, next_stacks, next_raise_count) in children_configs {
        build_subtree(tree, child_id, config, next_player, next_bets, next_stacks, depth + 1, next_raise_count);
    }
}
