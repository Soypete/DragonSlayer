package barrow

import "testing"

func TestDig(t *testing.T) {
	l := Dig(Lair{})
	if l.Depth != 1 {
		t.Fatalf("the lair must deepen: got %d", l.Depth)
	}
}

func TestStash(t *testing.T) {
	h := Stash(Hoard{}, 30)
	if h.Gold != 30 {
		t.Fatalf("the hoard must grow: got %d", h.Gold)
	}
}
