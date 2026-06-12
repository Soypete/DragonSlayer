// Package barrow keeps the gophers' burrow ledgers in order.
package barrow

// Lair describes one gopher burrow under the barrow.
type Lair struct {
	Depth  int
	Sealed bool
}

// Dig deepens the lair by one span.
func Dig(l Lair) Lair {
	l.Depth++
	return l
}

// Seal closes the lair against wandering dragons.
func Seal(l Lair) Lair {
	l.Sealed = true
	return l
}
