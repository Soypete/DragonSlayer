---
title: "F — Curriculum: multiline-change trials (counts + visual line)"
labels: "area: vim,component: curriculum,good first issue,enhancement"
---

**The quest.** Teach multiline edits two ways: the **count** shortcut (`3dd` is to `dd` what `4w` was to `w`) and **visual-line**'s inverted grammar (select, *then* strike).

**Scope.** `VimTrial`s in `trials.ts`:
1. `3dd` / `2cc` deleting/changing a run of lines (reuse the count concept from Tier 2).
2. `Vjjd` (or `Vjd`) selecting and deleting a block — lesson names the "select first, then act" inversion explicitly.
3. (optional) `Vjjy` then `p` to duplicate a block.

**Acceptance criteria.**
- [ ] Each trial: lesson, 3-rung hints, `par`, `parSolution`; test replays through the engine to `goal`.
- [ ] Visual-mode lesson states the grammar inversion; count lesson references `4w`.
- [ ] Tier matches the epic decision; gating verified.
- [ ] `npm test` + `npm run typecheck` pass, coverage holds.

**Files.** `src/vim/trials.ts`, `src/vim/trials.test.ts`.
**Deps.** **Needs D and E.**