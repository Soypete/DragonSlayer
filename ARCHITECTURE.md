# Dragonslayer (`gme`) — Architecture

A terminal RPG built with **TypeScript + Ink 5** (React for the terminal — the same
rendering stack Claude Code uses). Bugs are dragons; you are a knight. You slay
dragons by making real code reliably tested: typing battles weaken them, but only
real coverage improvements kill them. Win = 100% line coverage + a passing
end-to-end suite in the target repo.

## Ground rules for every module

- Node 24, ESM (`"type": "module"`), `moduleResolution: NodeNext` — **all relative
  imports must use `.js` extensions** (e.g. `import { x } from '../types.js'`).
- All domain types live in `src/types.ts`. Modules import ONLY from `src/types.ts`
  and node builtins / installed deps (`ink`, `react`, `fast-glob`). Modules never
  import each other — except `src/ui/` and `src/index.tsx`, which wire everything.
- Dependencies are already installed. Do not run `npm install` in the project root.
- Everything is local. No network calls, no auth. The only subprocesses are the
  user-configured test commands and the optional `claude -p` oracle call.
- Pure logic should be unit-tested with vitest (`*.test.ts` colocated). Test files
  are excluded from `tsc` build by tsconfig.
- `npm run typecheck` must pass for your files (other modules may not exist yet —
  that's fine, just ensure YOUR files have no errors of their own).

## Module map

```
src/
  types.ts            # shared contract (done — read it first, do not modify)
  game/               # agent: game-core
    ranks.ts naming.ts quests.ts state.ts
  repo/               # agent: repo-scanner
    config.ts scanner.ts runner.ts
  typing/             # agent: typing-engine
    engine.ts snippets.ts
  ai/                 # agent: oracle
    oracle.ts
  ui/                 # agent: ui (after modules exist)
    App.tsx theme.ts screens/* components/*
  index.tsx           # agent: ui — CLI entry
practice-dungeon/     # agent: practice-dungeon — standalone fixture project
```

## Module specs

### `src/game/` (game-core)

- **ranks.ts** — `export const RANKS: Rank[]` (page→dragonlord, minXp 0, 250, 750,
  1750, 3500, 6000, 10000). `rankForXp(xp): Rank`, `nextRank(xp): Rank | null`.
- **naming.ts** — `dragonName(file: string): { name: string; species: DragonSpecies }`.
  Deterministic (hash the path; no Math.random) so saves stay stable. Names like
  "Vexmaw the Untested", flavor by directory/extension.
- **state.ts** — save/load + pure reducers:
  - `savePath(repoPath): string` → `~/.gme/saves/<sha1-of-abs-repo-path>.json`
  - `loadSave(repoPath): SaveGame | null`, `writeSave(save): void` (mkdir -p).
  - `newSave(repoPath): SaveGame`.
  - `applyScan(save, scan: RepoScan, dragons: Dragon[]): SaveGame` — merges fresh
    dragons (preserving `weakened` on survivors), awards XP for coverage delta
    (+15 XP per +1% total line coverage), marks newly slain dragons
    (+2×maxHp XP each, +50 gold), updates `lastScan`, refreshes quest objectives.
  - `applyBattle(save, dragonId, result: BattleResult): SaveGame` — adds XP/gold,
    bumps `weakened` (cap 1), updates stats.
  - `hasWon(save, scan): boolean` — totals.lines.pct === 100 AND playwright
    configured with ≥1 spec (e2e quest objective complete).
- **quests.ts** — `generateQuests(scan: RepoScan, dragons: Dragon[], existing: Quest[]): Quest[]`.
  Deterministic ids so regeneration preserves status. Quest set:
  - one `slay` quest per top-5 biggest living dragon,
  - `coverage` milestone quests (50/75/90/100% total line coverage),
  - `tdd` quest: "the test count must rise" (testFiles count > count at quest creation),
  - `ci` quest: workflows exist + hasTestJob,
  - `e2e` quest: playwright configured, ≥1 spec.
  `refreshQuestObjectives(quests, scan, dragons): Quest[]` marks objectives/status.

### `src/repo/` (repo-scanner)

- **config.ts** — `resolveConfig(repoPath: string): Promise<GameConfig>`:
  1. If `<repo>/gme.config.json` exists, merge it over defaults.
  2. Else guess from package.json scripts (prefer `test:coverage`, `coverage`,
     fall back to `npx vitest run --coverage`). e2e from `test:e2e` if present.
  3. Defaults: coverageSummaryGlobs `["coverage/coverage-summary.json", "**/coverage/coverage-summary.json"]`
     (ignore node_modules), sourceGlobs `["src/**/*.{ts,tsx,js,jsx}", "app/**/*.{ts,tsx,js,jsx}", "lib/**/*.{ts,tsx,js,jsx}"]`,
     excludeGlobs for `*.test.*`, `*.spec.*`, `**/node_modules/**`, `**/dist/**`, `**/*.d.ts`.
- **scanner.ts** —
  - `scanRepo(cfg: GameConfig): Promise<RepoScan>` — fast-glob the source/test files,
    find newest coverage-summary.json among globs and parse it (istanbul
    json-summary format: `{ total: {...}, "<abs path>": { lines: {...}, ... } }`;
    normalize absolute keys to repo-relative posix paths). Detect playwright
    (playwright.config.* anywhere outside node_modules; count `*.spec.*` files
    under its dir / `e2e|tests` dirs). Detect CI (`.github/workflows/*.yml`,
    hasTestJob if any file content matches /\b(test|vitest|jest|playwright)\b/i).
  - `buildDragons(scan: RepoScan): Dragon[]` — one dragon per source file with
    coverage data and lines.pct < 100 (hp = uncovered lines), PLUS files with NO
    coverage entry at all (hp = file line count, the most dangerous kind).
    Uses naming via a callback param `(file) => {name, species}` so repo/ doesn't
    import game/ — signature: `buildDragons(scan, namer)`.
- **runner.ts** — `runCommand(command: string, cwd: string, onOutput?: (chunk: string) => void): Promise<CommandRun>`.
  Spawn via `child_process.spawn` with shell: true, stream combined output,
  tail-truncate stored output to 8000 chars, never throw on nonzero exit.

### `src/typing/` (typing-engine)

- **engine.ts** — a pure state machine (no React):
  - `createBattle(snippets: TypingSnippet[], dragonHp: number): BattleState`
  - `feedKey(state, char, timestampMs): BattleState` — handles correct/incorrect,
    backspace (`'\b'`), advances snippets. Tracks per-keystroke correctness,
    combo streak, mistakes.
  - `battleResult(state): BattleResult` — wpm = (correct chars / 5) / minutes,
    accuracy = correct / total, damage = round(wpm × accuracy² × snippetCount),
    xp = round(damage × (0.5 + accuracy/2)).
  - Export `BattleState` interface from this file (UI reads it to render: current
    snippet, typed-so-far with correctness flags, combo, elapsed).
  - Timestamps always passed in (testable, no Date.now inside reducers).
- **snippets.ts** —
  - `snippetsFromFile(absPath: string, count: number): Promise<TypingSnippet[]>` —
    read the file, pick "interesting" contiguous 1–2 line chunks (skip blanks,
    imports, lone braces; prefer lines 20–120 chars; collapse leading whitespace
    to none, internal whitespace normalized to single spaces). Deterministic
    selection (seeded by file content hash), tagged kind 'code'.
  - `incantations(file: string, count: number): TypingSnippet[]` — test-flavored
    template snippets targeting the file, e.g.
    `expect(slay('${basename}')).toBe(true)`, `describe('${basename}', () => { it('holds the line', () => {`,
    kind 'incantation'.

### `src/ai/` (oracle)

- **oracle.ts** — `consultOracle(scan: RepoScan, dragons: Dragon[], timeoutMs = 30000): Promise<OracleProphecy>`:
  - Try `claude -p <prompt> --output-format json` via execFile (no shell), prompt
    asks for JSON `{hotspots:[{file,reason}], proclamation}` given the top
    uncovered files. Parse `result` field of the CLI's JSON envelope; tolerate
    fenced code blocks. On any error/timeout/missing binary → fallback.
  - `fallbackProphecy(scan, dragons): OracleProphecy` — rank by hp desc, reasons
    like "97 uncovered lines and no test file names it". Deterministic, source 'fallback'.

### `src/ui/` + `src/index.tsx` (ui — built last)

- `index.tsx`: parse argv (`--repo <path>`, default `./practice-dungeon` if it
  exists else cwd), resolveConfig → scan → load/new save → render `<App>`.
  Use Ink `render` with `exitOnCtrlC`.
- Screens (state machine in App): **Title** (continue/new quest), **Map** (file-tree
  of dragons, arrow navigation, shows HP bars, coverage %, rank/XP header),
  **Battle** (typing UI: snippet with green/red per-char, WPM/accuracy/combo live,
  damage summary at end), **Quests** (quest log), **Oracle** (prophecy view,
  spinner while consulting), **Forge** (runs coverage/test command with streamed
  output, then rescans — this is how dragons actually die), **Victory**.
- Keybindings shown in a footer: arrows move, enter engage, q quests, o oracle,
  f forge (run coverage), e run e2e, esc back, ctrl+c quit.
- Theme in `theme.ts` (colors, HP bar renderer, sigils). Keep components small.
- Persist save via game/state after every battle and rescan.

### `practice-dungeon/` (practice-dungeon)

Standalone vitest project used to develop/play before pointing at a real repo:
- Own `package.json` (private, type module, devDeps: vitest + @vitest/coverage-v8),
  scripts: `test` → `vitest run`, `test:coverage` → `vitest run --coverage`.
  Vitest config with coverage reporters `['text', 'json-summary']` and
  `coverage.include: ['src/**']`. **Run `npm install` inside practice-dungeon only.**
- `src/` ~5 small TS modules with personality (potion brewing, drawbridge logic,
  dragon math, quest ledger, moat auth) — a few latent bugs, plain functions, no deps.
- `tests/` covering ~2 modules well, leaving the rest uncovered → 3+ dragons of
  varied size out of the box.
- A `gme.config.json` at its root pointing commands at vitest.
- Verify: `npm run test:coverage` works in that dir and emits
  `coverage/coverage-summary.json`.

### `src/vim/` (sword-school — vim trials)

A k9s-style vim minigame: NO external editor is spawned. The game's own pure
interpreter handles a POSIX-vi-compatible motion subset inside an Ink sub-window.
Skills transfer to bare `vi`. Tutorials/hints are a hard requirement: the player
is a vim novice learning the operator grammar for the first time.

- **engine.ts** — pure modal interpreter over `VimBuffer` (see types.ts):
  - `createVimBuffer(lines: string[], cursor?: VimCursor): VimBuffer`
  - `vimKey(buffer, key: string): VimKeyResult` — pure; key is a single char or
    one of `<esc>`, `<cr>`, `<bs>`. Supported, by curriculum tier:
    1. `h j k l x`
    2. `w b e 0 ^ $ gg G` + count prefixes (`3w`, `5j`)
    3. operators `d y` + motions (`dw`, `d$`, `dd`, `yy`), `p P`
    4. insert mode `i a I A o O`, change `c` (`cw`, `cc`, `c$`), `<esc>` back
    5. `f F t T ; ,` and `/term<cr>` `n N`
    6. text objects `iw aw i" a" i( a( i{ a{` with `c d y` (e.g. `ciw`, `di(`)
  - `goalMet(buffer, goal: TrialGoal): boolean`
  - `keysFromString(seq: string): string[]` — parse `"3wciwfoo<esc>"` into keys
    (used to validate parSolutions and play lesson demos).
  - Unhandled keys return `handled: false` and leave the buffer unchanged.
    Cursor clamps to line ends in normal mode (vi behavior). Keep semantics
    POSIX-vi-faithful for the supported subset; anything else is out of scope.
- **trials.ts** — the curriculum (modeled on ThePrimeagen's vim-fundamentals
  ordering) + progression logic:
  - `export const TRIALS: VimTrial[]` — 4–6 trials per tier, 6 tiers. Buffer
    contents are short themed code samples (dragons/castles/potions). Every
    trial has a lesson card a novice can follow, a 3-rung hint ladder, and a
    parSolution that MUST be validated in tests by replaying it through the
    engine (`keysFromString` → `vimKey`…) asserting `goalMet` and
    `keys.length === par`.
  - `starsFor(keystrokes, par, hintsUsed): 1|2|3`, `trialXp(...)`,
    `bladeFor(stars): number` (1.0 / 1.2 / 1.5),
  - `applyTrial(progress: VimProgress | undefined, result: TrialResult): VimProgress`
    (keeps best result per trial, unlocks tier N+1 when ≥3 trials of tier N have
    ≥2 stars, sets bladeBuff to the best blade earned this session),
  - `nextTrial(progress): VimTrial | null`, `newVimProgress(): VimProgress`.
- **UI integration** (`src/ui/screens/TrialsScreen.tsx` + wiring):
  - Map screen gains `v` → sword-school. Trial flow per trial: lesson card
    (demo plays the parSolution-taught keys with explanation) → untimed
    practice rep → scored attempt (keystroke count + clock visible) → debrief
    showing the player's keys vs the par solution with a one-line explanation.
  - `?` during a trial climbs the hint ladder (rung 2+ costs 5 gold each);
    hintsUsed recorded in the result.
  - BattleScreen consumes `save.vim.bladeBuff` as a damage multiplier (shown as
    "⚔ sharpened blade ×1.2"), then resets it to 1 via applyTrial-adjacent
    helper or inline; persist save after each trial and consumed buff.
  - Map navigation also accepts `j/k`, `gg/G` (and `/` filter if cheap) so the
    whole game feels k9s-ish.
  - Save: `save.vim?: VimProgress` (optional — old saves lack it; reducers
    already spread unknown fields through).

### Quest pledges → Claude skills (planned, build after sword-school)

Selecting a quest on the Guild Board "pledges" it, and the game forges a Claude
Code skill into the TARGET repo so the player's normal coding sessions know
about the quest:

- **QuestsScreen becomes selectable** (also fixes the read-only-board confusion):
  ↑↓/jk choose, `enter` pledges (or renounces) a quest. Pledged quests show a
  sigil and float to the top; the map header shows the active pledge as a
  standing reminder, re-shown after every forge while incomplete.
- **`src/ai/squire.ts`** — `forgeSkill(quest, scan, cfg, dragons): Promise<{ path, source }>`:
  writes `<targetRepo>/.claude/skills/gme-<quest-slug>/SKILL.md` with proper
  frontmatter (name, description) and a body containing: the quest objective,
  current real state (file's uncovered lines / coverage %, test file locations,
  the repo's test + coverage commands), and concrete guidance for completing it
  (e.g. "write vitest tests for these uncovered functions; run <coverageCommand>;
  the quest completes on the next forge"). Content tailored via `claude -p`
  (same pattern as oracle.ts: timeout + silent fallback to a deterministic
  template that is already genuinely useful). Never overwrites a SKILL.md it
  didn't generate (marker comment in the file). Renouncing a pledge removes the
  generated skill dir.
- **Save**: `pledges: string[]` (quest ids) — optional field on SaveGame like
  `vim`, spread-safe for old saves.

### The Daily Augury (planned, build with pledges)

The Oracle's Cave grants ONE true consultation per real calendar day:

- **Judgment is deterministic** from real metric deltas since the last augury
  (total coverage trend, dragons slain, test-file count, pledge honored?):
  improvement → blessing, decay → curse, first visit → neutral omen. The save
  stores `augury?: { date: 'YYYY-MM-DD'; kind: 'blessing'|'curse'|'omen'; edict: string; honored?: boolean }`.
  Same-day revisits show the standing edict ("the cave is silent until tomorrow").
- **Edicts are agent style law**: each augury carries a concrete coding-style
  mandate (curse example: "no code without a failing test first; every mock must
  justify itself"; blessing example: "prefer table-driven tests named for the
  behavior they guard"). Flavor + edict via `claude -p` with deterministic
  template fallback (oracle.ts pattern).
- **Harness integration**: the edict is written into a marker-fenced managed
  block (`<!-- gme:oracle-edict:start -->` … `:end`) in the target repo's
  `CLAUDE.md` (Claude Code) and `AGENTS.md` (opencode, pi). REPLACE only the
  fenced block; create the file with just the block if absent; never touch
  content outside the markers. Removing the augury (new day) rewrites the block.
- **Stakes**: blessings grant a small same-day XP multiplier; a curse honored by
  the next augury (its metric improved while it stood) pays redemption XP.

### The Guild Shop (planned, build with pledges/augury)

Gold's sinks — XP is leveling (rank thresholds), gold buys consumables:

- **Forge a Claude skill — 25 gold**: the pledge system's SKILL.md generation is
  a purchase (pledging itself is free). You buy *Claude skills* with gold.
- **Hint rungs — 5 gold** each, rungs 2–3 of the vim-trial hint ladder (already spec'd).
- **Oracle's token — 50 gold**: one extra augury today, bypassing the daily gate.
- **Sharpening stone — 30 gold**: a 1.2× blade buff for the next battle without
  earning it in the sword-school.

Shop screen reachable from the map (`s`); purchases persist via the save;
insufficient gold shows the price grayed with a "the guild extends no credit"
line. Economy tuning baseline: battles pay ~damage/10 gold (≈10/battle at the
playtester's pace), kills +50.

## Build order

1. Contracts (done): types.ts, tsconfig, package.json.
2. Parallel: game-core, repo-scanner, typing-engine, oracle, practice-dungeon.
3. ui (needs 2's exports).
4. Integration verify: typecheck, unit tests, boot against practice-dungeon with
   ink-testing-library.
