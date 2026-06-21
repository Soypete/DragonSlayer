---
title: "E — Engine: visual-line mode (V, linewise select, d / y / c)"
labels: "area: vim,component: engine,enhancement,help wanted"
---

**The quest.** The cleanest mental model for multiline edits is "**select first, then act**" — the inverse of normal mode's "act, then motion". That needs a real new mode.

**Scope.**
- Add `'visual-line'` to the `VimMode` union in `src/types.ts` (a shared-contract change — law 2; keep the engine PR pure and self-contained).
- `V` enters visual-line from normal mode, anchoring the current line. `j`/`k`/`gg`/`G` (and counts) grow/shrink the selection. `d`/`x`, `y`, `c` act on the selected lines (`c` leaves insert mode on a cleared span). `<esc>` cancels back to normal.
- Yanked/deleted span is linewise for `p`/`P`.
- A footer/visible affordance so players can tell they're in visual mode (law 7) — coordinate the UI bit in `src/ui`, but land engine state first.

**Acceptance criteria.**
- [ ] `V` then motions select the right line range; `d`/`y`/`c`/`<esc>` behave linewise and restore `normal` correctly.
- [ ] No regression to existing modes; unhandled keys in visual-line return `{ handled: false }`.
- [ ] `engine.test.ts` covers enter/grow/shrink/operate/cancel; pure logic; `.js` imports (laws 3, 5).
- [ ] `npm test` + `npm run typecheck` pass, coverage holds.

**Files.** `src/types.ts` (`VimMode`), `src/vim/engine.ts`, `src/vim/engine.test.ts`; UI footer follow-up in `src/ui`.
**Deps.** None. **Blocks F.**