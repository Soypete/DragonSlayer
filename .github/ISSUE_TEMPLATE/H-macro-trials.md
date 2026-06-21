---
title: "H — Curriculum: macro trials"
labels: "area: vim,component: curriculum,good first issue,enhancement"
---

**The quest.** Teach macros as "record the arts you already know, then unleash them down a column." Must come last; the demo should be an obviously repetitive multi-line edit so the *why* is self-evident.

**Scope.** 2–3 `VimTrial`s:
1. Record a small edit, replay once with `@a`.
2. Replay across several lines (`3@a` or `@a` then `@@`), e.g. fixing the same typo or appending the same suffix line by line.

**Acceptance criteria.**
- [ ] Each trial: lesson, 3-rung hints, `par`, `parSolution`; test replays through the engine to `goal`.
- [ ] Lesson references earlier-tier motions ("everything from the Cutting Arts, recorded once").
- [ ] Tier matches the epic decision; gating verified.
- [ ] `npm test` + `npm run typecheck` pass, coverage holds (laws 1, 6, 7).

**Files.** `src/vim/trials.ts`, `src/vim/trials.test.ts`.
**Deps.** **Needs G.**