//! siege.rs — the integration trial: the citadel under outside attack.

use crab_citadel::moat_holds;

#[test]
fn moat_repels_a_modest_siege() {
    assert!(moat_holds(40));
}
