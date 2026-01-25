//! Equity Matrix Computation
//! 
//! Computes win/loss/tie equity between all hand combinations in two ranges.
//! Used by the solver for O(1) equity lookups during CFR iterations.

use crate::poker::{Card, evaluate_7_cards};

/// Check if two card sets share any cards (blockers)
#[inline]
fn has_blocker(cards1: &[Card], cards2: &[Card]) -> bool {
    for c1 in cards1 {
        for c2 in cards2 {
            if c1 == c2 {
                return true;
            }
        }
    }
    false
}

/// Check if hand shares any cards with board
#[inline]
fn hand_blocked_by_board(hand: &[Card], board: &[Card]) -> bool {
    has_blocker(hand, board)
}

/// Compute equity matrix between two ranges on a given board.
/// 
/// # Arguments
/// * `board` - Community cards (5 cards for river)
/// * `range1` - First player's range (list of hands, each hand is 2 cards)
/// * `range2` - Second player's range (list of hands, each hand is 2 cards)
/// 
/// # Returns
/// Flattened matrix of size `range1.len() * range2.len()` where:
/// * `1.0` = hand1 wins
/// * `0.0` = hand1 loses  
/// * `0.5` = tie
/// * `NaN` = impossible matchup (blocked)
pub fn compute_equity_matrix(
    board: &[Card],
    range1: &[Vec<Card>],
    range2: &[Vec<Card>],
) -> Vec<f32> {
    let n1 = range1.len();
    let n2 = range2.len();
    let mut result = vec![f32::NAN; n1 * n2];
    
    for (i, hand1) in range1.iter().enumerate() {
        // Skip if hand1 blocked by board
        if hand_blocked_by_board(hand1, board) {
            continue;
        }
        
        // Build 7-card hand for player 1
        let mut cards1: Vec<Card> = hand1.clone();
        cards1.extend(board.iter().cloned());
        let score1 = evaluate_7_cards(&cards1);
        
        for (j, hand2) in range2.iter().enumerate() {
            let idx = i * n2 + j;
            
            // Check blockers
            if hand_blocked_by_board(hand2, board) {
                continue; // result[idx] stays NaN
            }
            
            if has_blocker(hand1, hand2) {
                continue; // result[idx] stays NaN
            }
            
            // Build 7-card hand for player 2
            let mut cards2: Vec<Card> = hand2.clone();
            cards2.extend(board.iter().cloned());
            let score2 = evaluate_7_cards(&cards2);
            
            // Compare (lower score = better hand)
            result[idx] = if score1 < score2 {
                1.0 // hand1 wins
            } else if score1 > score2 {
                0.0 // hand1 loses
            } else {
                0.5 // tie
            };
        }
    }
    
    result
}

/// Compute single matchup equity between two hands on a board
/// 
/// # Returns
/// * `Some(1.0)` = hand1 wins
/// * `Some(0.0)` = hand1 loses
/// * `Some(0.5)` = tie
/// * `None` = impossible matchup (blocked)
pub fn compute_single_equity(
    board: &[Card],
    hand1: &[Card],
    hand2: &[Card],
) -> Option<f32> {
    // Check blockers
    if hand_blocked_by_board(hand1, board) ||
       hand_blocked_by_board(hand2, board) ||
       has_blocker(hand1, hand2) {
        return None;
    }
    
    let mut cards1: Vec<Card> = hand1.to_vec();
    cards1.extend(board.iter().cloned());
    
    let mut cards2: Vec<Card> = hand2.to_vec();
    cards2.extend(board.iter().cloned());
    
    let score1 = evaluate_7_cards(&cards1);
    let score2 = evaluate_7_cards(&cards2);
    
    Some(if score1 < score2 {
        1.0
    } else if score1 > score2 {
        0.0
    } else {
        0.5
    })
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::poker::Card;

    fn cards_from_str(s: &str) -> Vec<Card> {
        s.split_whitespace()
            .map(|cs| Card::from_str(cs).expect(&format!("Invalid card: {}", cs)))
            .collect()
    }

    #[test]
    fn test_single_equity_win() {
        let board = cards_from_str("Kh Qd Jc 2s 3h");
        let hand1 = cards_from_str("As Ks"); // Pair of kings with A kicker
        let hand2 = cards_from_str("Kd 5c"); // Pair of kings with 5 kicker
        
        let equity = compute_single_equity(&board, &hand1, &hand2);
        assert_eq!(equity, Some(1.0), "AK should beat K5");
    }

    #[test]
    fn test_single_equity_loss() {
        let board = cards_from_str("Kh Qd Jc 2s 3h");
        let hand1 = cards_from_str("Kd 5c");
        let hand2 = cards_from_str("As Ks");
        
        let equity = compute_single_equity(&board, &hand1, &hand2);
        assert_eq!(equity, Some(0.0), "K5 should lose to AK");
    }

    #[test]
    fn test_single_equity_tie() {
        let board = cards_from_str("As Ks Qs Js Ts"); // Royal flush on board
        let hand1 = cards_from_str("2c 3c");
        let hand2 = cards_from_str("4c 5c");
        
        let equity = compute_single_equity(&board, &hand1, &hand2);
        assert_eq!(equity, Some(0.5), "Should tie on board royal flush");
    }

    #[test]
    fn test_single_equity_blocked() {
        let board = cards_from_str("Kh Qd Jc 2s 3h");
        let hand1 = cards_from_str("As Kh"); // Kh is on board!
        let hand2 = cards_from_str("Kd 5c");
        
        let equity = compute_single_equity(&board, &hand1, &hand2);
        assert_eq!(equity, None, "Should be blocked - Kh on board");
    }

    #[test]
    fn test_single_equity_hand_collision() {
        let board = cards_from_str("Kh Qd Jc 2s 3h");
        let hand1 = cards_from_str("As Ks");
        let hand2 = cards_from_str("As Kd"); // As overlaps!
        
        let equity = compute_single_equity(&board, &hand1, &hand2);
        assert_eq!(equity, None, "Should be blocked - As in both hands");
    }

    #[test]
    fn test_equity_matrix() {
        let board = cards_from_str("Kh Qd Jc 2s 3h");
        let range1 = vec![
            cards_from_str("As Ks"),
            cards_from_str("9c 9d"),
        ];
        let range2 = vec![
            cards_from_str("Kd 5c"),
            cards_from_str("4c 5d"),
        ];
        
        let matrix = compute_equity_matrix(&board, &range1, &range2);
        
        assert_eq!(matrix.len(), 4);
        // AKs vs K5o - AK wins
        assert!(!matrix[0].is_nan());
        // AKs vs 45o - AK wins  
        assert!(!matrix[1].is_nan());
        // 99 vs K5o
        assert!(!matrix[2].is_nan());
        // 99 vs 45o
        assert!(!matrix[3].is_nan());
    }
}
