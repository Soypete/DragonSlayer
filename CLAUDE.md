# CLAUDE.md

This file guides Claude Code (and other AI agents) working in this repo.

**See [AGENTS.md](./AGENTS.md) for the full guide** — build/verify commands, the
pure-engine architecture rule, and (most importantly) the **Style & Flavor**
section that every player-facing string must follow.

Quick reminders:

- Run `npm test` and `npm run typecheck` before committing; coverage must not drop.
- The vim engine (`src/vim/engine.ts`) is a pure `(buffer, key) → {buffer,
  handled}` state machine — no clocks or IO. The wall clock lives only in the UI.
- A key can't be *taught* in `src/vim/trials.ts` until the engine *handles* it —
  trials are validated by replaying `parSolution` through the real engine.
- Player-facing prose (trials, screen copy, engine comments) carries a consistent
  fantasy/RPG voice. **Copy the shape of an existing tier-1–6 trial** when writing
  new ones, and follow the Do/Don't list in AGENTS.md.
