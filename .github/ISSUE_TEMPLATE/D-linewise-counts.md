---
title: "D — Engine: linewise operator counts (3dd, 2cc, 3yy)"
labels: "area: vim,component: engine,good first issue,enhancement"
---

**The quest.** Counts work before motions (`4w`) but not, today, before doubled linewise operators. `3dd` should delete three lines, `2cc` change two, `3yy` yank three.

**Scope.** In `engine.ts`, when a `pendingCount` precedes a doubled linewise operator (`dd`/`cc`/`yy`), apply the operator across `count` lines from the cursor (clamped to the buffer). Register stays linewise for `p`/`P`.

**Acceptance criteria.**
- [ ] `3dd`, `2cc`, `3yy` operate on the correct line span; counts past EOF clamp without throwing.
- [ ] `cc`/`dd`/`yy` with no count behave exactly as before (no regressions).
- [ ] `engine.test.ts` covers counts, clamping, and the register's linewise flag; pure logic (law 3).
- [ ] `npm test` + `npm run typecheck` pass, coverage holds.

**Files.** `src/vim/engine.ts`, `src/vim/engine.test.ts`.
**Deps.** None. **Feeds F.**