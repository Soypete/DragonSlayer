package barrow

// Hoard tallies the treasure a gopher guards.
type Hoard struct {
	Gold int
}

// Stash adds coins to the hoard.
func Stash(h Hoard, coins int) Hoard {
	h.Gold += coins
	return h
}

// Plunder empties the hoard — dragons love this one.
func Plunder(h Hoard) (Hoard, int) {
	loot := h.Gold
	h.Gold = 0
	return h, loot
}
