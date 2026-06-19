---
title: "A — Curriculum: word-change decision card (cw vs ciw vs diw vs daw)"
labels: "area: vim,component: curriculum,good first issue,enhancement"
---

**The quest.** Every word-change key is already taught in isolation (`cw` in Tier 4, `ciw`/`diw`/`daw` in Tier 6) and the engine already handles all four — but learners leave without knowing *which to reach for*. Add one consolidating trial whose entire job is the decision rule.

**Scope.** A single new `VimTrial` in `src/vim/trials.ts` (no engine changes). The lesson card teaches the choice, not new keys:
- at a word's **start** → `cw`
- **anywhere inside** a word → `ciw`
- **removing** a word for good → `daw` (closes the spacing)
- **replacing** a word → `ciw` / `diw` (`diw` leaves the gap to retype into)

Reuse the proven contrast-aside style from the existing `daw` card ("`diw` would leave two spaces").

**Acceptance criteria.**
- [ ] One `VimTrial` with `lesson` (heading/body/demoKeys), `keysTaught`, a 3-rung `hints` tuple (nudge → exact keys → cursor-by-cursor walkthrough), `par`, and a `parSolution`.
- [ ] A `trials.test.ts` case replays `parSolution` through the engine and reaches `goal` at ≤ `par` keystrokes.
- [ ] `npm test` and `npm run typecheck` pass; coverage does not drop (law 1).
- [ ] Flavor in register, clarity first (law 6); the card teaches its own mechanic (law 7).

**Files.** `src/vim/trials.ts`, `src/vim/trials.test.ts`.
**Deps.** None.