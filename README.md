# 🐉 Dragonslayer (`gme`)

**Bugs are dragons. Coverage is the blade. 100% wins the realm.**

A terminal RPG about making real code reliable. Point it at any repo —
JS/TS, Go, Python, or Rust — and every file with untested lines becomes a
dragon whose HP is its uncovered line count. You
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
npm run dev                # open the campaign picker (every realm you know)
```

The practice dungeon is a tiny deliberately-undertested project that ships with
the game — three dragons out of the box. To slay one for real:

1. Engage a dragon (`enter`) and battle through its scrolls.
2. In another terminal, write a test for its file in `practice-dungeon/tests/`.
3. Back in the game, press `f` — the Forge runs real `vitest --coverage`,
   rescans, and any file that reached 100% gets its dragon slain, with bounty.

## Choosing a realm

The game decides which repo you're questing in, in this order:

1. **`--repo <path>`** — an explicit summons always wins:
   `npm run dev -- --repo /path/to/your/project`. Opening a repo this way
   also registers it (see below), so next time the picker knows it.
2. **The campaign picker** — launch with no flag and the title screen lists
   every realm the game knows: campaigns with a save file in `~/.gme/saves/`
   *and* any paths registered in `~/.gme/config.json`. It also offers a
   one-keystroke **"Quest here"** suggestion (the default repo: the bundled
   `./practice-dungeon` when you're in this repo's root, otherwise the
   current directory) and **"Chart a new realm…"**, a prompt where you type
   any path. Realms whose paths no longer exist are shown dimmed.

### Adding repo paths to the config

The picker's registry lives at `~/.gme/config.json` and is meant to be
hand-edited — add any repos you want to see on the title screen:

```json
{
  "version": 1,
  "repos": [
    "/home/you/code/my-api",
    "/home/you/code/my-app"
  ]
}
```

Every repo you open in-game is appended automatically; entries are never
auto-removed, so delete stale paths yourself. Saves are keyed by absolute
path, so a moved repo starts a fresh campaign.

## Questing in your own repo

The game reads the manifests at your repo's root to detect its language and
equips that toolchain's standard kit — test command, coverage command, and the
coverage dialect it will read. JavaScript/TypeScript realms additionally get
their commands divined from `package.json` scripts.

### Supported languages

| Language | Detected by | Tests | Coverage | You need installed |
|----------|-------------|-------|----------|--------------------|
| JS / TS | `package.json` | `npx vitest run` (or divined: npm/jest/`node --test`) | istanbul `coverage-summary.json` | Node + npm |
| Go | `go.mod` | `go test ./...` | `go test ./... -coverprofile=coverage.out -covermode=atomic` | [Go](https://go.dev/doc/install) |
| Python | `pyproject.toml` / `setup.py` / `setup.cfg` / `requirements.txt` | `pytest` | `pytest --cov --cov-report=json` | [pytest](https://docs.pytest.org/en/stable/getting-started.html) + [pytest-cov](https://pytest-cov.readthedocs.io/) |
| Rust | `Cargo.toml` | `cargo test` | `cargo llvm-cov --json --output-path coverage.json` | [rustup](https://rustup.rs) + [cargo-llvm-cov](https://github.com/taiki-e/cargo-llvm-cov#installation) |

When several manifests fly at one gate, the strongest banner wins: go >
rust > python > js (`package.json` ranks last because it flies over many
non-JS repos as mere tooling). Declare `"language"` in `gme.config.json` to
overrule the guess.

Before each scan the game checks the armory: any required binary missing from
your PATH gets a torch-orange warning on the realm map with an install link —
tests still run with whatever you do have. (Coverage tools the game can't see,
like the `pytest-cov` plugin, only show up when the forge command fails.)

To be explicit about anything, drop a `gme.config.json` in the target repo:

```json
{
  "testCommand": "npm test",
  "coverageCommand": "npm run test:coverage",
  "e2eCommand": "npm run test:e2e",
  "coverageSummaryGlobs": ["coverage/coverage-summary.json"],
  "sourceGlobs": ["src/**/*.{ts,tsx}"],
  "excludeGlobs": ["**/*.test.*", "**/dist/**"],
  "packages": ["packages/*"],
  "excludePackages": ["packages/legacy-*"]
}
```

Every field is optional; omitted fields keep their language's defaults:

| Field | What it does | Default (js shown) |
|-------|--------------|--------------------|
| `language` | overrides detection: `js`, `go`, `python`, `rust` | detected from root manifests |
| `coverageFormat` | which dialect the coverage artifact speaks: `istanbul-summary`, `go-coverprofile`, `coverage-py-json`, `llvm-cov-json` | the language's native dialect |
| `testCommand` | runs the unit suite | divined from scripts, else `npx vitest run` |
| `coverageCommand` | must emit the `coverageFormat` artifact | divined, else `npx vitest run --coverage` |
| `e2eCommand` | the end-to-end suite | divined from `test:e2e` |
| `coverageSummaryGlobs` | where coverage artifacts are found | `coverage/coverage-summary.json` + `**/coverage/coverage-summary.json` |
| `sourceGlobs` | files that can host dragons | `src`, `app`, `lib`, and `{packages,apps,libs}/*/src` trees |
| `excludeGlobs` | never host dragons | tests, specs, `node_modules`, `dist`, `.d.ts` |
| `testGlobs` | where the test files live | the language's test patterns |
| `packages` | monorepo allow-list (see below) | unset — every package counts |
| `excludePackages` | monorepo deny-list | unset |

The escape hatch composes: a Python repo managed by
[pixi](https://pixi.sh) (or poetry, uv, hatch…) just wraps the commands —

```json
{
  "testCommand": "pixi run pytest",
  "coverageCommand": "pixi run pytest --cov --cov-report=json"
}
```

For JS realms the coverage command must emit an istanbul-style
`coverage-summary.json` (vitest: coverage reporter `json-summary`; jest:
`--coverageReporters=json-summary`). Playwright is detected automatically for
the e2e quest line. Rust note: `cargo llvm-cov` needs a one-time
`cargo install cargo-llvm-cov`; until then `cargo test` still runs and your
dragons simply keep full HP (no coverage proof, no slayings).

### Monorepos

In a turbo/pnpm/nx workspace where each package emits its own
`coverage/coverage-summary.json`, the scanner merges **all** of them into one
realm: each package's file paths are prefixed with the package directory
(`packages/api/src/auth.ts`), duplicate entries resolve newest-wins, and the
realm's totals are recomputed from the merged set — so dragons span the whole
kingdom and victory means every package at 100%.

The `packages` / `excludePackages` globs control which workspaces count: list
package *directories* relative to the repo root (e.g. `"packages/*"`,
`"apps/web"`). Include `"."` in `packages` to also keep a root-level summary.

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

### Winning points

Everything pays in XP (which sets your rank) and gold (which the Guild Shop
drains). Where it all comes from:

| Deed | XP | Gold |
|------|----|------|
| Typing battle | WPM × accuracy² × scrolls × (0.5 + accuracy/2) | damage ÷ 10 |
| Coverage gained at the Forge | +15 per +1% total line coverage | — |
| Dragon slain (file hits 100%) | 2 × the dragon's max HP | 50 bounty |
| Coverage quests (50/75/90/100%) | 150 / 300 / 600 / 1200 | XP ÷ 10 |
| Slay / TDD / CI / e2e quests | per quest | XP ÷ 10 |
| Sword-school trial | tier × 10 × stars (up to 180) | — |
| Daily augury | blessing: ×1.1 battle XP today; an honored curse pays redemption XP tomorrow | — |

Accuracy is squared everywhere, so clean typing beats fast typing; real tests
beat both — the Forge and its slain-dragon bounties are the only road to
victory. Three-star trials also sharpen your blade (×1.5 damage next battle).

### Share your campaign

Slain something big? Post your daily stats — rank, XP, coverage %, dragons
slain (the title screen and victory screen both show them) — on Discord or
socials with **#PeteTheDragonSlayer** so other knights can find the guild.

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
~/.gme/saves/<sha1-of-absolute-repo-path>.json   # one campaign per target repo
~/.gme/config.json                               # the realm registry (repo paths)
```

One save per target repo (XP, gold, rank, dragons, quests, stats), written
after every battle, forge, and scan. Because saves are keyed by the absolute
path, moving a repo starts a fresh campaign at its new address. To reset a
campaign, delete its file (or pick "Swear a new oath" on the title screen).
The loaders tolerate missing or corrupt files, so hand-editing either file is
safe-ish — and yes, that means you can give yourself gold; the Oracle sees all
and judges silently.

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
