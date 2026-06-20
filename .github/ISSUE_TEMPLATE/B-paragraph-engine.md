---
title: "B — Engine: paragraph motions { } and text objects ip / ap"
labels: "area: vim,component: engine,enhancement"
---

**The quest.** Paragraph navigation is missing entirely. Add the motions and objects so later trials can teach them.

**Scope.** In `src/vim/engine.ts`:
- `}` jumps forward to the next blank-line boundary; `{` jumps backward. Empty lines bound a paragraph (match vi). Honor count prefixes (`3}`) — the count machinery already exists.
- Text objects `ip` (inner paragraph) and `ap` (around paragraph, incl. trailing blank line), usable with the existing `d`/`y`/`c` operators (`dap`, `cip`, `yip`).
- Tokenize `{` / `}` in `keysFromString` if not already.

**Acceptance criteria.**
- [ ] `}`/`{` move correctly across blank-line-separated blocks, including at file edges and with counts.
- [ ] `dip`/`dap`/`cip`/`yap` operate on the right line span; `ap` consumes a trailing blank line, `ip` does not.
- [ ] Unhandled combinations return `{ handled: false }` and leave the buffer untouched.
- [ ] `engine.test.ts` covers each motion/object incl. edge cases; logic stays pure (law 3); `.js` import discipline (law 5).
- [ ] `npm test` + `npm run typecheck` pass, coverage holds.

**Files.** `src/vim/engine.ts`, `src/vim/engine.test.ts` (maybe `keysFromString`).
**Deps.** None. **Blocks C.**