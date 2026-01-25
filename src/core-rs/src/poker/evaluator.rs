//! High-Performance Hand Evaluator for Texas Hold'em
//! 
//! Implements a Cactus Kev inspired algorithm using:
//! - Prime number product for rank combinations
//! - Bit patterns for flush detection  
//! - Lookup tables for fast hand classification
//! 
//! Lower score = stronger hand (1 = Royal Flush, 7462 = worst high card)

use crate::poker::Card;
use lazy_static::lazy_static;

// ============================================================================
// CONSTANTS
// ============================================================================

/// Prime numbers for each rank (2-A), used for unique hand identification
/// This allows us to multiply primes to get a unique product for each rank combination
const PRIMES: [u32; 13] = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41];

/// Hand rank categories (lower = better)
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u8)]
pub enum HandRank {
    StraightFlush = 1,
    FourOfAKind = 2,
    FullHouse = 3,
    Flush = 4,
    Straight = 5,
    ThreeOfAKind = 6,
    TwoPair = 7,
    OnePair = 8,
    HighCard = 9,
}

impl HandRank {
    /// Get hand rank from score
    pub fn from_score(score: u16) -> Self {
        match score {
            1..=10 => HandRank::StraightFlush,
            11..=166 => HandRank::FourOfAKind,
            167..=322 => HandRank::FullHouse,
            323..=1599 => HandRank::Flush,
            1600..=1609 => HandRank::Straight,
            1610..=2467 => HandRank::ThreeOfAKind,
            2468..=3325 => HandRank::TwoPair,
            3326..=6185 => HandRank::OnePair,
            _ => HandRank::HighCard,
        }
    }
}

/// Get human-readable hand rank name
pub fn get_hand_rank_name(score: u16) -> &'static str {
    match score {
        1 => "Royal Flush",
        2..=10 => "Straight Flush",
        11..=166 => "Four of a Kind",
        167..=322 => "Full House",
        323..=1599 => "Flush",
        1600..=1609 => "Straight",
        1610..=2467 => "Three of a Kind",
        2468..=3325 => "Two Pair",
        3326..=6185 => "One Pair",
        _ => "High Card",
    }
}

// ============================================================================
// LOOKUP TABLES
// ============================================================================

lazy_static! {
    /// Lookup table for flush hands (indexed by bit pattern)
    static ref FLUSH_TABLE: Vec<u16> = generate_flush_table();
    
    /// Lookup table for unique5 hands (non-flush, no pairs)
    static ref UNIQUE5_TABLE: Vec<u16> = generate_unique5_table();
    
    /// Lookup table mapping prime products to hand values
    static ref PRIME_PRODUCT_TABLE: std::collections::HashMap<u32, u16> = generate_prime_product_table();
}

/// Initialize lookup tables (call once at startup)
pub fn init_lookup_tables() {
    // Force lazy_static initialization
    let _ = FLUSH_TABLE.len();
    let _ = UNIQUE5_TABLE.len();
    let _ = PRIME_PRODUCT_TABLE.len();
}

// ============================================================================
// TABLE GENERATION
// ============================================================================

/// Generate flush lookup table
/// Maps 13-bit pattern (one bit per rank) to hand score
fn generate_flush_table() -> Vec<u16> {
    let mut table = vec![0u16; 8192]; // 2^13
    
    // Generate all 5-bit combinations for flushes
    let mut rank = 1u16;
    
    // Straight flushes first (scores 1-10)
    // A-high (royal) to 5-high (wheel)
    let straight_patterns = [
        0b1111100000000u16, // A K Q J T (Royal)
        0b0111110000000u16, // K Q J T 9
        0b0011111000000u16, // Q J T 9 8
        0b0001111100000u16, // J T 9 8 7
        0b0000111110000u16, // T 9 8 7 6
        0b0000011111000u16, // 9 8 7 6 5
        0b0000001111100u16, // 8 7 6 5 4
        0b0000000111110u16, // 7 6 5 4 3
        0b0000000011111u16, // 6 5 4 3 2
        0b1000000001111u16, // A 5 4 3 2 (wheel)
    ];
    
    for pattern in &straight_patterns {
        table[*pattern as usize] = rank;
        rank += 1;
    }
    
    // Regular flushes (non-straight) - scores 323-1599
    rank = 323;
    for bits in (0u16..8192).rev() {
        if bits.count_ones() == 5 {
            // Check it's not a straight
            if !straight_patterns.contains(&bits) {
                table[bits as usize] = rank;
                rank += 1;
            }
        }
    }
    
    table
}

/// Generate unique5 (non-flush straights and high cards) lookup table
fn generate_unique5_table() -> Vec<u16> {
    let mut table = vec![0u16; 8192];
    
    // Straights (non-flush) - scores 1600-1609
    let straight_patterns = [
        0b1111100000000u16,
        0b0111110000000u16,
        0b0011111000000u16,
        0b0001111100000u16,
        0b0000111110000u16,
        0b0000011111000u16,
        0b0000001111100u16,
        0b0000000111110u16,
        0b0000000011111u16,
        0b1000000001111u16, // wheel
    ];
    
    let mut rank = 1600u16;
    for pattern in &straight_patterns {
        table[*pattern as usize] = rank;
        rank += 1;
    }
    
    // High cards - scores 6186-7462
    rank = 6186;
    for bits in (0u16..8192).rev() {
        if bits.count_ones() == 5 && !straight_patterns.contains(&bits) {
            table[bits as usize] = rank;
            rank += 1;
        }
    }
    
    table
}

/// Generate prime product to hand value mapping for paired hands
fn generate_prime_product_table() -> std::collections::HashMap<u32, u16> {
    let mut table = std::collections::HashMap::new();
    
    // Four of a Kind (scores 11-166)
    let mut rank = 11u16;
    for quads in (0..13).rev() {
        for kicker in (0..13).rev() {
            if quads != kicker {
                let product = PRIMES[quads].pow(4) * PRIMES[kicker];
                table.insert(product, rank);
                rank += 1;
            }
        }
    }
    
    // Full House (scores 167-322)
    rank = 167;
    for trips in (0..13).rev() {
        for pair in (0..13).rev() {
            if trips != pair {
                let product = PRIMES[trips].pow(3) * PRIMES[pair].pow(2);
                table.insert(product, rank);
                rank += 1;
            }
        }
    }
    
    // Three of a Kind (scores 1610-2467)
    rank = 1610;
    for trips in (0..13).rev() {
        for k1 in (0..13).rev() {
            if k1 == trips { continue; }
            for k2 in (0..k1).rev() {
                if k2 == trips { continue; }
                let product = PRIMES[trips].pow(3) * PRIMES[k1] * PRIMES[k2];
                table.insert(product, rank);
                rank += 1;
            }
        }
    }
    
    // Two Pair (scores 2468-3325)
    rank = 2468;
    for p1 in (0..13).rev() {
        for p2 in (0..p1).rev() {
            for kicker in (0..13).rev() {
                if kicker != p1 && kicker != p2 {
                    let product = PRIMES[p1].pow(2) * PRIMES[p2].pow(2) * PRIMES[kicker];
                    table.insert(product, rank);
                    rank += 1;
                }
            }
        }
    }
    
    // One Pair (scores 3326-6185)
    rank = 3326;
    for pair in (0..13).rev() {
        for k1 in (0..13).rev() {
            if k1 == pair { continue; }
            for k2 in (0..k1).rev() {
                if k2 == pair { continue; }
                for k3 in (0..k2).rev() {
                    if k3 == pair { continue; }
                    let product = PRIMES[pair].pow(2) * PRIMES[k1] * PRIMES[k2] * PRIMES[k3];
                    table.insert(product, rank);
                    rank += 1;
                }
            }
        }
    }
    
    table
}

// ============================================================================
// EVALUATION FUNCTIONS
// ============================================================================

/// Evaluate a 5-card hand
/// Returns a score where lower = better (1 = Royal Flush, 7462 = worst high card)
#[inline]
pub fn evaluate_5_cards(cards: &[Card; 5]) -> u16 {
    // Build rank bit pattern and suit counts
    let mut rank_bits: u16 = 0;
    let mut suit_counts = [0u8; 4];
    let mut prime_product: u32 = 1;
    
    for card in cards {
        let rank = card.rank() as usize;
        let suit = card.suit() as usize;
        
        rank_bits |= 1 << rank;
        suit_counts[suit] += 1;
        prime_product *= PRIMES[rank];
    }
    
    // Check for flush
    let is_flush = suit_counts.iter().any(|&c| c == 5);
    
    // Check if all ranks are unique (possible straight or high card)
    let all_unique = rank_bits.count_ones() == 5;
    
    if is_flush {
        return FLUSH_TABLE[rank_bits as usize];
    }
    
    if all_unique {
        return UNIQUE5_TABLE[rank_bits as usize];
    }
    
    // Paired hand - lookup by prime product
    *PRIME_PRODUCT_TABLE.get(&prime_product).unwrap_or(&7462)
}

/// Evaluate the best 5-card hand from 7 cards
/// Returns a score where lower = better
pub fn evaluate_7_cards(cards: &[Card]) -> u16 {
    if cards.len() < 5 {
        return 7462; // Worst possible
    }
    
    if cards.len() == 5 {
        let arr: [Card; 5] = [cards[0], cards[1], cards[2], cards[3], cards[4]];
        return evaluate_5_cards(&arr);
    }
    
    // For 6 or 7 cards, try all 5-card combinations
    let n = cards.len();
    let mut best = 7463u16;
    
    // Generate C(n, 5) combinations
    for i in 0..n {
        for j in (i+1)..n {
            for k in (j+1)..n {
                for l in (k+1)..n {
                    for m in (l+1)..n {
                        let hand: [Card; 5] = [
                            cards[i], cards[j], cards[k], cards[l], cards[m]
                        ];
                        let score = evaluate_5_cards(&hand);
                        if score < best {
                            best = score;
                        }
                    }
                }
            }
        }
    }
    
    best
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

    fn eval_hand(s: &str) -> u16 {
        let cards = cards_from_str(s);
        evaluate_7_cards(&cards)
    }

    #[test]
    fn test_royal_flush() {
        let score = eval_hand("As Ks Qs Js Ts");
        assert_eq!(score, 1, "Royal flush should be score 1");
    }

    #[test]
    fn test_straight_flush() {
        let score = eval_hand("9h 8h 7h 6h 5h");
        assert!(score >= 2 && score <= 10, "Straight flush score: {}", score);
    }

    #[test]
    fn test_four_of_a_kind() {
        let score = eval_hand("As Ah Ad Ac Ks");
        assert!(score >= 11 && score <= 166, "Quads score: {}", score);
    }

    #[test]
    fn test_full_house() {
        let score = eval_hand("As Ah Ad Ks Kh");
        assert!(score >= 167 && score <= 322, "Full house score: {}", score);
    }

    #[test]
    fn test_flush() {
        let score = eval_hand("As Ks Qs Js 9s");
        assert!(score >= 323 && score <= 1599, "Flush score: {}", score);
    }

    #[test]
    fn test_straight() {
        let score = eval_hand("Ah Ks Qd Jc Th");
        assert!(score >= 1600 && score <= 1609, "Straight score: {}", score);
    }

    #[test]
    fn test_three_of_a_kind() {
        let score = eval_hand("As Ah Ad Ks Qh");
        assert!(score >= 1610 && score <= 2467, "Trips score: {}", score);
    }

    #[test]
    fn test_two_pair() {
        let score = eval_hand("As Ah Ks Kh Qd");
        assert!(score >= 2468 && score <= 3325, "Two pair score: {}", score);
    }

    #[test]
    fn test_one_pair() {
        let score = eval_hand("As Ah Ks Qh Jd");
        assert!(score >= 3326 && score <= 6185, "One pair score: {}", score);
    }

    #[test]
    fn test_high_card() {
        let score = eval_hand("As Ks Qd Jc 9h");
        assert!(score >= 6186 && score <= 7462, "High card score: {}", score);
    }

    #[test]
    fn test_quads_beats_full_house() {
        let quads = eval_hand("As Ah Ad Ac Ks");
        let full_house = eval_hand("As Ah Ad Ks Kh");
        assert!(quads < full_house, "Quads ({}) should beat Full House ({})", quads, full_house);
    }

    #[test]
    fn test_full_house_beats_flush() {
        let full_house = eval_hand("As Ah Ad Ks Kh");
        let flush = eval_hand("As Ks Qs Js 9s");
        assert!(full_house < flush, "Full House ({}) should beat Flush ({})", full_house, flush);
    }

    #[test]
    fn test_7_card_evaluation() {
        // Royal flush with 2 extra cards
        let score = eval_hand("As Ks Qs Js Ts 2c 3d");
        assert_eq!(score, 1, "7-card royal flush should be score 1");
    }

    #[test]
    fn test_wheel_straight() {
        let score = eval_hand("Ah 2s 3d 4c 5h");
        assert!(score >= 1600 && score <= 1609, "Wheel should be a straight: {}", score);
    }

    #[test]
    fn test_wheel_straight_flush() {
        let score = eval_hand("Ah 2h 3h 4h 5h");
        assert!(score >= 2 && score <= 10, "Wheel flush should be straight flush: {}", score);
    }
}
