//! crab-citadel — drawbridge arithmetic for the keep on the riverbank.

/// Raise the drawbridge: each turn of the winch lifts it three spans.
pub fn raise_drawbridge(turns: u32) -> u32 {
    turns * 3
}

/// Whether the moat holds against `pressure` siege engines at the bank.
pub fn moat_holds(pressure: i64) -> bool {
    if pressure < 0 {
        return true;
    }
    pressure <= 100
}

#[cfg(test)]
mod trials {
    use super::raise_drawbridge;

    #[test]
    fn winch_turns_thrice() {
        assert_eq!(raise_drawbridge(2), 6);
    }
}
