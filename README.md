# 🐉 Dragonslayer (`gme`)

**Bugs are dragons. Coverage is the blade. 100% wins the realm.**

A terminal RPG about making real code reliable. Point it at any repo: every file
with untested lines becomes a dragon whose HP is its uncovered line count. You
weaken dragons in monkeytype-style typing battles over real snippets from your
code — but the only thing that *kills* a dragon is writing an actual test and
running real coverage at the Forge. Win the realm by reaching 100% line coverage
with a passing end-to-end suite.

Built with TypeScript + [Ink](https://github.com/vadimdemedes/ink) (React for
the terminal — the same rendering stack Claude Code uses). Everything runs
locally: no accounts, no network, no telemetry.

Made with **Claude (Fable 5)** in Claude Code — a game built to sharpen your
typing speed, vim motions, and code-reading skills while making real codebases
more reliable.

## Install & play

Requires **Node 22+** (developed on 24) and npm.

```bash
git clone <this-repo> gme && cd gme
npm install
npm run dev:dungeon        # play the bundled practice dungeon
```

The practice dungeon is a tiny deliberately-undertested project that ships with
the game — three dragons out of the box. To slay one for real:

1. Engage a dragon (`enter`) and battle through its scrolls.
2. In another terminal, write a test for its file in `practice-dungeon/tests/`.
3. Back in the game, press `f` — the Forge runs real `vitest --coverage`,
   rescans, and any file that reached 100% gets its dragon slain, with bounty.

## Questing in your own repo

```bash
npm run dev -- --repo /path/to/your/project
```

The game guesses your test commands from `package.json` scripts. To be explicit,
drop a `gme.config.json` in the target repo:

```json
{
  "testCommand": "npm test",
  "coverageCommand": "npm run test:coverage",
  "e2eCommand": "npm run test:e2e",
  "coverageSummaryGlobs": ["coverage/coverage-summary.json"],
  "sourceGlobs": ["src/**/*.{ts,tsx}"],
  "excludeGlobs": ["**/*.test.*", "**/dist/**"]
}
```

Requirements for the target repo: its coverage command must emit an
istanbul-style `coverage-summary.json` (vitest: coverage reporter
`json-summary`; jest: `--coverageReporters=json-summary`). Playwright is
detected automatically for the e2e quest line.

> **Monorepos:** the scanner currently reads the *newest single*
> `coverage-summary.json` it finds — it does not yet merge summaries across
> packages. In a turbo/pnpm/nx workspace, point the game at one package
> (e.g. `--repo path/to/monorepo/apps/web`) for accurate dragons. Merged
> multi-package realms and an in-game repo picker are planned — see the
> issue tracker.

## How the game works

- **Dragons** — one per source file with uncovered lines. HP = uncovered lines.
  Files with *no coverage data at all* spawn the biggest dragons of all.
- **Typing battles** — five scrolls per battle: real snippets from the dragon's
  file plus test incantations. Damage = WPM × accuracy² × scrolls. Battles
  weaken the beast and earn XP and gold; they never kill.
- **The Forge** (`f`) — runs your real coverage command, rescans the realm,
  slays dragons whose files hit 100%, and pays coverage-delta XP (+15 per +1%).
- **Quests** (`q`) — slay bounties for the five biggest dragons, coverage
  milestones (50/75/90/100%), a TDD quest (the test count must rise), CI
  fortification, and the e2e campaign.
- **The Oracle** (`o`) — AI-assisted discovery: if you have the `claude` CLI
  installed it divines which files are riskiest and why; otherwise a built-in
  heuristic prophecy ranks them by uncovered lines. Optional either way.
- **Ranks** — Page → Squire → Knight-Errant → Knight → Dragon Knight → Paladin
  → Dragonlord, by XP.
- **Victory** — 100% total line coverage *and* a configured, passing e2e suite.
- **Saves** — automatic, per-repo, at `~/.gme/saves/`. Quit anytime with
  `ctrl+c`; your campaign continues where you left off.

### Keys

| Key | Action |
|-----|--------|
| `↑↓` / `enter` | roam the map / engage a dragon |
| `q` | quest log |
| `o` | consult the Oracle |
| `f` | the Forge — run real coverage, rescan |
| `e` | e2e patrol — run the end-to-end suite |
| `esc` | flee / back |
| `ctrl+c` | abandon the realm (progress is saved) |

## Development

```bash
npm test            # vitest (200+ tests)
npm run typecheck   # strict tsc
npm run dev:dungeon # play against the practice dungeon
npm run build       # compile to dist/
```

### Where state lives

All game state is plain JSON in your home directory — never inside the game
repo or the repo you're questing in:

```
~/.gme/saves/<sha1-of-absolute-repo-path>.json
```

One file per target repo (XP, gold, rank, dragons, quests, stats). It's written
after every battle, forge, and scan. To reset a campaign, delete its file (or
pick "Swear a new oath" on the title screen). The loader tolerates missing or
corrupt files, so hand-editing is safe-ish — and yes, that means you can give
yourself gold; the Oracle sees all and judges silently.

Architecture notes live in [ARCHITECTURE.md](ARCHITECTURE.md): pure modules
(`src/game`, `src/repo`, `src/typing`, `src/ai`, `src/vim`) that only share
`src/types.ts`, wired together by the Ink UI in `src/ui`.

## Roadmap

- ⚔️ **Sword-school (vim trials)** — landing now: a k9s-style sub-window with a
  built-in vi-motion interpreter. Six tutorial tiers from `hjkl` to `ciw`
  (modeled on vim-fundamentals), keystroke-golf scoring against par, a
  three-rung hint ladder, and a sharpened-blade damage buff for your next
  battle. No vim install required; skills transfer to bare `vi`.
- Balance pass: enemy-red HP bars, unique dragon epithets, damage normalized to
  dragon size.
- First-run onboarding quest that teaches the scan → battle → forge loop.
