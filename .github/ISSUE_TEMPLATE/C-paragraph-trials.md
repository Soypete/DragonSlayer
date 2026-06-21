---
title: "C — Curriculum: paragraph navigation trials"
labels: "area: vim,component: curriculum,good first issue,enhancement"
---

**The quest.** Teach the paragraph keys from B, leaning on a model players already own: **`{` and `}` are `w` and `b` for paragraphs**, and `ip`/`ap` join the Tier-6 text-object family (`ip` is "inner paragraph", sibling of `iw`).

**Scope.** 2–3 `VimTrial`s in `trials.ts`:
1. `}` / `{` navigation across a multi-paragraph scroll (cursor goal).
2. `dap` removing a whole paragraph (text goal).
3. (optional) `cip` rewriting a paragraph's body.

**Acceptance criteria.**
- [ ] Each trial: lesson card, 3-rung hints, `par`, `parSolution`; test replays through the engine to `goal`.
- [ ] Trials sit in the tier the epic chose; if Tier 7, `MAX_TIER`/tier comment updated and gating verified.
- [ ] Lessons use the `w`/`b` analogy and a contrast aside (`ip` vs `ap` spacing).
- [ ] `npm test` + `npm run typecheck` pass, coverage holds (laws 1, 6, 7).

**Files.** `src/vim/trials.ts`, `src/vim/trials.test.ts`.
**Deps.** **Needs B.**