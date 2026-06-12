"""Venom brewing for the spire's serpents."""

POTENCY_CAP = 10


def brew(fangs: int, gland: int) -> int:
    """Mix fang count with gland output, capped at the spire's limit."""
    return min(fangs * gland, POTENCY_CAP)


def dilute(potency: int) -> int:
    """Halve a brew for the apprentice serpents."""
    return potency // 2
