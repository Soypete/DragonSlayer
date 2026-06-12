"""Scale-shedding rites for the spire's serpents."""


def shed(count: int) -> int:
    """A serpent sheds one scale per moon, never below none."""
    if count <= 0:
        return 0
    return count - 1


def polish(scales: list[int]) -> int:
    """Sum the lustre of a polished hoard of scales."""
    total = 0
    for lustre in scales:
        total += lustre
    return total
