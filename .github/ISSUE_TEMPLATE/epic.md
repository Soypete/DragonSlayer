---
title: EPIC — Expand the Sword-School: paragraph navigation, multiline edits, macros, word-change clarity
labels: epic,area: vim,enhancement
---

**The sword-school (`src/vim`) teaches six tiers today, ThePrimeagen-fundamentals order. Four gaps remain, three of them genuinely missing from the engine:**

- **Word changes** — keys exist; learners just don't know *which* (`cw`/`ciw`/`diw`/`daw`). Curriculum-only.
- **Paragraph navigation** — `{` `}` and `ip`/`ap` are absent from `engine.ts`.
- **Multiline changes** — linewise operator counts (`3dd`) and **visual-line mode** (`V`…`d`) are absent.
- **Macros** — `q`/`@`/`@@` and named registers are absent (biggest lift).

Each feature is split into an **engine** issue and a **curriculum** issue so the lesson cards land as good-first-issues once the keys work. The engine is a pure `(buffer, key) → VimKeyResult` state machine and `parSolution` strings are replayed through it in tests — so a key can't be taught before the engine handles it.

### Decisions
- [ ] **Tier**: add a new **Tier 7 "Advanced Arts"** (bump `MAX_TIER`, update the `tier` comment in `types.ts`, audit UI tier rendering) — or fold each into an existing tier. Pick one before C/F/H.

### Tasks
- [ ] A — Word-change decision card *(curriculum, good first issue)*
- [ ] B — Engine: paragraph motions `{` `}` + objects `ip`/`ap`
- [ ] C — Paragraph navigation trials *(needs B)*
- [ ] D — Engine: linewise operator counts (`3dd`/`2cc`/`3yy`)
- [ ] E — Engine: visual-line mode (`V` + `d`/`y`/`c`)
- [ ] F — Multiline-change trials *(needs D + E)*
- [ ] G — Engine: macro record & replay (`q`/`@`/`@@`, registers)
- [ ] H — Macro trials *(needs G)*