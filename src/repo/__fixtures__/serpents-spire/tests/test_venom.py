"""Trials for the venom brewers (and one polished hoard)."""

from spire.scales import polish
from spire.venom import brew, dilute


def test_brew_caps_at_the_spire_limit():
    assert brew(4, 3) == 10


def test_dilute_halves_for_apprentices():
    assert dilute(8) == 4


def test_polish_sums_the_lustre():
    assert polish([2, 3, 4]) == 9
