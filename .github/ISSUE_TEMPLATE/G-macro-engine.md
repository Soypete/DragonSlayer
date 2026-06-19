---
title: "G — Engine: macro record & replay (q, @, @@, registers)"
labels: "area: vim,component: engine,enhancement,help wanted"
---

**The quest.** Macros are the hardest concept and the biggest engine lift — they capture keystrokes the player already knows and replay them. Epic-sized; consider splitting into recording vs. replay sub-tasks.

**Scope.**
- State on `VimBuffer` (`src/types.ts`, law 2): named registers `a`–`z` and a recording slot, e.g. `recording: { register: string; keys: string[] } | null` plus `lastMacro: string | null`. (Today `register` is a single unnamed slot — decide whether macro registers share or extend it.)
- `q{a-z}` starts recording into that register (appending every subsequent key); `q` stops. `@{a-z}` replays the stored keys; `@@` repeats the last macro.
- Replay must run through the same pure `(buffer, key)` engine — expand a stored sequence by feeding its keys one at a time — so `parSolution` strings like `qadwjq2@a` stay interpretable by `keysFromString` and the test harness.

**Acceptance criteria.**
- [ ] Record → stop → replay round-trips; `@@` repeats last; counts (`3@a`) work.
- [ ] Recording captures raw keys faithfully (incl. mode switches); nested/recursive cases fail safe, never loop forever.
- [ ] `keysFromString` tokenizes `q`/`@` sequences so `parSolution` replays in tests.
- [ ] Heavy `engine.test.ts` coverage; pure logic, no clocks (law 3); coverage holds.
- [ ] `npm test` + `npm run typecheck` pass.

**Files.** `src/types.ts`, `src/vim/engine.ts`, `src/vim/engine.test.ts` (and `keysFromString`).
**Deps.** None. **Blocks H.**