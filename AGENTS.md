# AGENTS.md — working in Dragonslayer

Guidance for AI agents (and humans) contributing to this repo. Read this before
writing trials, screen copy, or any player-facing prose — the game has a
consistent fantasy/RPG voice, and new work must keep the flavor.

## Build & verify

```bash
npm test            # vitest — engine, trials, and UI suites
npm run typecheck   # tsc --noEmit
npm run dev:dungeon # play the bundled practice dungeon to see changes live
```

Always run `npm test` and `npm run typecheck` before committing; coverage must
not drop. The vim engine is a **pure** `(buffer, key) → {buffer, handled}` state
machine — no clocks, no IO (an immutability test enforces it). The wall clock is
read only in the UI layer. See `ARCHITECTURE.md` for module boundaries; modules
import shared types from `src/types.ts` and never from each other (the UI layer
excepted).

Trials are validated by replaying each `parSolution` through the real engine, so
a key cannot be *taught* (`src/vim/trials.ts`) before the engine *handles* it
(`src/vim/engine.ts`).

## Style & Flavor

This is a **fantasy/medieval RPG framing of vim instruction**: swordsmanship is
the metaphor for editing, bugs are dragons, the codebase is a realm. The writing
is archaic, evocative, and precise — **flavor serves the teaching, never
obscures it.** The vim mechanic is always taught accurately first; flavor wraps
it second.

### The world & vocabulary

Reach for the established nouns, not generic ones:

| Concept | In-world term |
|---|---|
| vim editing / motions | **the blade**, swordwork, a strike, a cut |
| the vim curriculum | **the Sword-School**; lessons are **trials**, grouped in **tiers** |
| insert mode | **the quill** ("draw the quill" / "sheathe the quill") |
| a bug / coverage gap | a **dragon** (named species: Syntax Wyrm, Null Drake, Race Wyvern, Flaky Hydra, Off-by-One Imp, Regression Behemoth, Legacy Lindworm) |
| the codebase | **the realm** / the kingdom |
| a test file | a **scroll** |
| running tests + coverage | the **Forge** (where dragons truly fall) |
| a single character | a **rune** |
| a code snippet (typing battle) | an **incantation** / spell |
| the player | a **squire** → **knight** → … → **dragonlord** (ranks) |
| currency / progression | **gold** (bounties) and **XP** |

### Naming conventions

- **Trial ids:** kebab-case, tier-prefixed — `t3-echo-the-incantation`,
  `t6-words-heart`, `t8-record-the-art`.
- **Trial titles:** Title Case, imperative and evocative — `Strike the Word's
  Heart`, `Swallow the Word Whole`, `Hunt the Rune`, `Raze the Verse`. Use
  fantasy action verbs: Strike, Swallow, Leap, Raze, Hollow, Hunt, Echo, Mark.
- **Tier names** (`TIER_NAMES` in `src/ui/screens/TrialsScreen.tsx`): a flavored
  name + the keys it drills, e.g. `'The Cutting Arts · d y p'`.
- **Colors** (`src/ui/theme.ts`) carry meaning — use them only in UI, never in
  trial prose: `gold` (rank/treasure), `verdant` (covered/victory), `ember`
  (danger/mistakes), `torch` (warnings/half-slain), `steel` (borders/secondary),
  `parchment` (hints/dim), `arcana` (oracle/AI), `banner` (selection/highlight).

### Lesson-card voice (the heaviest flavor)

Every `VimTrial` lesson is `{ heading, body, demoKeys }` plus a 3-rung `hints`
ladder. Match the originals exactly:

- **`heading`** — a plain-English statement of the mechanic, lowercase keys, no
  arrow/`·` notation, no shouting. Good: `'yy copies the line, p pastes it
  below'`, `'ciw changes the word you are INSIDE — no need to stand at its
  start'`. Avoid meta framing like "four strikes, one decision: a · b · c".
- **`body`** — 3–4 sentences, second person ("you", "the cursor"). Open with one
  line of flavor or the plain mechanic, teach the *what* and a little *why*, then
  **always close with a single `Your task: …` sentence** that states the mission.
  Keep ALL-CAPS emphasis sparing (a word or two, like `RIGHT`/`INSIDE`).
- **`demoKeys`** — the ideal keystroke string, parseable by `keysFromString`
  (`<esc>`, `<cr>`, `<bs>` are tokens). No ellipses or invented notation.
- **`keysTaught`** — **atomic keys/objects only**: `['c', 'cw']`, `['ip', 'ap',
  'dap']`, `['q', '@']`. Never phrases like `'count + dd'`, `'qa…q'`, or `'3dd'`.
- **`hints`** — exactly three rungs, escalating:
  1. **nudge** — a riddle that points at the idea without the keys.
  2. **exact keys** — `'Type ciw, then valiant, then Escape.'`
  3. **walkthrough** — cursor-by-cursor narration that **ends with a key count**:
     `'… Type icebolt, press Escape. Eleven keys, zero travel.'` Every rung-3
     hint ends with `N keys` (or `N keys, <aside>`).

### Code-comment voice

Inline comments in `engine.ts` are brief and flavored, explaining edge/failure
states: `// recognized motion that cannot move: the blade whiffs`, `// x on an
empty line: the blade meets only air`, `// dd on the last remaining line leaves
one empty line — a bare castle, not a void`. Keep this register when adding to
the engine.

### Do / Don't

**Do:** teach the mechanic first with a concrete example · end `body` with `Your
task:` · end rung-3 hints with a key count · use medieval nouns over generic
ones · keep `keysTaught` atomic · give one canonical solution path.

**Don't:** weave the task into the explanation instead of a clean `Your task:`
line · use `·`/arrow notation or heavy ALL-CAPS in headings · put compound
phrases or notation in `keysTaught` · break second person ("the player", "one")
· hint at multiple solutions · drop the key count from a walkthrough · use color
names in trial prose.

When in doubt, open `src/vim/trials.ts` and copy the shape of an existing
tier-1–6 trial — they are the canonical reference for voice and structure.
