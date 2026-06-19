use workspace_core::reinforce;

#[test]
fn reinforces_the_gate() {
    assert_eq!(reinforce(2), 3);
}

