//! Card representation for high-performance poker evaluation.
//! 
//! Uses compact u8 storage (0..51) with efficient bitmask generation
//! for bitwise hand evaluation (Cactus Kev / Bitboard style).

use std::fmt;
use wasm_bindgen::prelude::*;

/// Rank constants (0-12: 2, 3, 4, 5, 6, 7, 8, 9, T, J, Q, K, A)
pub const RANK_2: u8 = 0;
pub const RANK_3: u8 = 1;
pub const RANK_4: u8 = 2;
pub const RANK_5: u8 = 3;
pub const RANK_6: u8 = 4;
pub const RANK_7: u8 = 5;
pub const RANK_8: u8 = 6;
pub const RANK_9: u8 = 7;
pub const RANK_T: u8 = 8;
pub const RANK_J: u8 = 9;
pub const RANK_Q: u8 = 10;
pub const RANK_K: u8 = 11;
pub const RANK_A: u8 = 12;

/// Suit constants (0-3: clubs, diamonds, hearts, spades)
pub const SUIT_CLUBS: u8 = 0;
pub const SUIT_DIAMONDS: u8 = 1;
pub const SUIT_HEARTS: u8 = 2;
pub const SUIT_SPADES: u8 = 3;

/// Rank characters for string conversion
const RANK_CHARS: [char; 13] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

/// Suit characters for string conversion (lowercase)
const SUIT_CHARS: [char; 4] = ['c', 'd', 'h', 's'];

/// A playing card represented as a single byte.
/// 
/// Internal storage: `card_index = rank * 4 + suit` where:
/// - `rank` is 0-12 (2 through Ace)
/// - `suit` is 0-3 (clubs, diamonds, hearts, spades)
/// 
/// This gives a unique index 0-51 for each card in the deck.
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash)]
pub struct Card(u8);

impl Card {
    /// Create a new card from rank (0-12) and suit (0-3).
    /// 
    /// # Panics
    /// Panics if rank >= 13 or suit >= 4.
    #[inline]
    pub fn new(rank: u8, suit: u8) -> Self {
        debug_assert!(rank < 13, "Rank must be 0-12, got {}", rank);
        debug_assert!(suit < 4, "Suit must be 0-3, got {}", suit);
        Card(rank * 4 + suit)
    }

    /// Create a card from its raw index (0-51).
    /// 
    /// # Panics
    /// Panics if index >= 52.
    #[inline]
    pub fn from_index(index: u8) -> Self {
        debug_assert!(index < 52, "Card index must be 0-51, got {}", index);
        Card(index)
    }

    /// Get the raw index (0-51) of this card.
    #[inline]
    pub fn index(&self) -> u8 {
        self.0
    }

    /// Get the rank (0-12) of this card.
    #[inline]
    pub fn rank(&self) -> u8 {
        self.0 / 4
    }

    /// Get the suit (0-3) of this card.
    #[inline]
    pub fn suit(&self) -> u8 {
        self.0 % 4
    }

    /// Generate a unique 64-bit bitmask for this card.
    /// 
    /// The bitmask layout uses bits 0-51, where each card maps to:
    /// `1 << (rank * 4 + suit)`
    /// 
    /// This non-overlapping mapping is useful for:
    /// - Fast set operations (union, intersection)
    /// - Card removal detection
    /// - Hand representation as a single u64
    #[inline]
    pub fn bitmask(&self) -> u64 {
        1u64 << self.0
    }

    /// Parse a card from a 2-character string like "As", "Th", "2c".
    /// 
    /// Case-insensitive for the suit character.
    /// Returns None if the string is invalid.
    pub fn from_str(s: &str) -> Option<Self> {
        if s.len() != 2 {
            return None;
        }

        let chars: Vec<char> = s.chars().collect();
        let rank_char = chars[0].to_ascii_uppercase();
        let suit_char = chars[1].to_ascii_lowercase();

        let rank = match rank_char {
            '2' => RANK_2,
            '3' => RANK_3,
            '4' => RANK_4,
            '5' => RANK_5,
            '6' => RANK_6,
            '7' => RANK_7,
            '8' => RANK_8,
            '9' => RANK_9,
            'T' => RANK_T,
            'J' => RANK_J,
            'Q' => RANK_Q,
            'K' => RANK_K,
            'A' => RANK_A,
            _ => return None,
        };

        let suit = match suit_char {
            'c' => SUIT_CLUBS,
            'd' => SUIT_DIAMONDS,
            'h' => SUIT_HEARTS,
            's' => SUIT_SPADES,
            _ => return None,
        };

        Some(Card::new(rank, suit))
    }

    /// Convert this card to a 2-character string like "As", "Th", "2c".
    pub fn to_string(&self) -> String {
        let rank_char = RANK_CHARS[self.rank() as usize];
        let suit_char = SUIT_CHARS[self.suit() as usize];
        format!("{}{}", rank_char, suit_char)
    }
}

impl fmt::Display for Card {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_string())
    }
}

// ============================================================================
// WASM EXPORTS
// ============================================================================

/// Parse a card string (e.g., "As", "Th", "2c") and return its index (0-51).
/// Returns 255 if the string is invalid.
#[wasm_bindgen]
pub fn parse_card(s: &str) -> u8 {
    Card::from_str(s).map(|c| c.index()).unwrap_or(255)
}

/// Convert a card index (0-51) to a string (e.g., "As", "Th", "2c").
/// Returns "??" for invalid indices.
#[wasm_bindgen]
pub fn card_to_string(c: u8) -> String {
    if c >= 52 {
        return "??".to_string();
    }
    Card::from_index(c).to_string()
}

/// Get the bitmask for a card index. Returns 0 for invalid indices.
#[wasm_bindgen]
pub fn card_bitmask(c: u8) -> u64 {
    if c >= 52 {
        return 0;
    }
    Card::from_index(c).bitmask()
}

/// Get the rank (0-12) of a card index. Returns 255 for invalid indices.
#[wasm_bindgen]
pub fn card_rank(c: u8) -> u8 {
    if c >= 52 {
        return 255;
    }
    Card::from_index(c).rank()
}

/// Get the suit (0-3) of a card index. Returns 255 for invalid indices.
#[wasm_bindgen]
pub fn card_suit(c: u8) -> u8 {
    if c >= 52 {
        return 255;
    }
    Card::from_index(c).suit()
}

// ============================================================================
// UNIT TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_card_new() {
        let card = Card::new(RANK_A, SUIT_SPADES);
        assert_eq!(card.rank(), RANK_A);
        assert_eq!(card.suit(), SUIT_SPADES);
    }

    #[test]
    fn test_parse_ace_of_spades() {
        let card = Card::from_str("As").expect("Should parse As");
        assert_eq!(card.rank(), RANK_A); // Ace = 12
        assert_eq!(card.suit(), SUIT_SPADES); // Spades = 3
        assert_eq!(card.to_string(), "As");
    }

    #[test]
    fn test_parse_ten_of_hearts() {
        let card = Card::from_str("Th").expect("Should parse Th");
        assert_eq!(card.rank(), RANK_T); // Ten = 8
        assert_eq!(card.suit(), SUIT_HEARTS); // Hearts = 2
        assert_eq!(card.to_string(), "Th");
    }

    #[test]
    fn test_parse_two_of_clubs() {
        let card = Card::from_str("2c").expect("Should parse 2c");
        assert_eq!(card.rank(), RANK_2); // Two = 0
        assert_eq!(card.suit(), SUIT_CLUBS); // Clubs = 0
        assert_eq!(card.to_string(), "2c");
    }

    #[test]
    fn test_parse_case_insensitive_suit() {
        let card1 = Card::from_str("As").expect("Should parse As");
        let card2 = Card::from_str("AS").expect("Should parse AS");
        assert_eq!(card1, card2);
    }

    #[test]
    fn test_parse_invalid() {
        assert!(Card::from_str("Xx").is_none());
        assert!(Card::from_str("A").is_none());
        assert!(Card::from_str("Asd").is_none());
        assert!(Card::from_str("").is_none());
    }

    #[test]
    fn test_bitmask_unique() {
        let mut seen: u64 = 0;
        for i in 0..52u8 {
            let card = Card::from_index(i);
            let mask = card.bitmask();
            
            // Verify this bit hasn't been seen before
            assert_eq!(seen & mask, 0, "Bitmask collision for card {}", i);
            
            // Mark this bit as seen
            seen |= mask;
        }
        
        // All 52 bits should be set (bits 0-51)
        assert_eq!(seen, (1u64 << 52) - 1);
    }

    #[test]
    fn test_bitmask_specific_cards() {
        // 2c should be bit 0 (rank=0, suit=0 -> index=0)
        let two_clubs = Card::from_str("2c").unwrap();
        assert_eq!(two_clubs.bitmask(), 1u64 << 0);

        // As should be bit 51 (rank=12, suit=3 -> index=51)
        let ace_spades = Card::from_str("As").unwrap();
        assert_eq!(ace_spades.bitmask(), 1u64 << 51);

        // Th should have rank=8, suit=2 -> index=34
        let ten_hearts = Card::from_str("Th").unwrap();
        assert_eq!(ten_hearts.index(), 8 * 4 + 2); // 34
        assert_eq!(ten_hearts.bitmask(), 1u64 << 34);
    }

    #[test]
    fn test_wasm_parse_card() {
        assert_eq!(parse_card("As"), 51);
        assert_eq!(parse_card("2c"), 0);
        assert_eq!(parse_card("Xx"), 255); // Invalid
    }

    #[test]
    fn test_wasm_card_to_string() {
        assert_eq!(card_to_string(51), "As");
        assert_eq!(card_to_string(0), "2c");
        assert_eq!(card_to_string(255), "??"); // Invalid
    }

    #[test]
    fn test_roundtrip_all_cards() {
        for i in 0..52u8 {
            let card = Card::from_index(i);
            let string = card.to_string();
            let parsed = Card::from_str(&string).expect("Should parse");
            assert_eq!(card, parsed, "Roundtrip failed for index {}", i);
        }
    }
}
