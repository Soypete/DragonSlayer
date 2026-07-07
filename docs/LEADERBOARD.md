# The Boards — leaderboard courier reference

The game-side spec for `gme leaderboard`: the CLI, the receipt schema, and the
canonical `contentHash`. **How to actually submit a run** is documented once,
in the [ds-submissions README](https://github.com/Soypete/ds-submissions#readme)
— this page is the reference the other repos cite.

Everything here runs locally. The courier writes a file; it never opens a
network connection. Publishing a receipt is a pull request you open yourself.

These are shell commands, run *outside* the game — quit (or open a second
terminal) before summoning the courier. Running from a clone via npm, the bare
`--` separator is mandatory or npm eats your flags and `--set` silently
vanishes:

```bash
npm start -- leaderboard whoami --set octocat
```

## The CLI

```
gme leaderboard — carry your haul to the boards

  whoami [--set <handle>]   show or claim your GitHub banner
  receipt [--repo <path>] [--day YYYY-MM-DD] [--out <file>|--stdout]
                            seal a day-haul + speedrun receipt
  trials --json             dump the trial catalog (id, tier, title, par)
```

- **`whoami --set <handle>`** claims your banner: the bare GitHub handle —
  `octocat`, not `@octocat` or a profile URL — lowercased (a leading `@` is
  forgiven and stripped) and stored with a `registeredAt` stamp in
  `~/.gme/config.json` alongside the realm registry (`src/game/registry.ts`).
  Claim it once; receipts can't be sealed without it.
- **`receipt`** seals the given day's haul (default: today) for the given
  realm (default: the one the courier rode in from) — the day's gold from the
  save's gold ledger plus your standing trial results. `--out` writes a file
  (forging any missing directories on the way), `--stdout` prints it.
- **`trials --json`** dumps the trial catalog; the leaderboard's
  `/api/sync-trials` uses this to refresh its board list.

Implementation: `src/ui/cli-leaderboard.ts` (the IO shell, outside Ink) and
`src/ui/receipt.ts` (pure — all IO injected).

## The receipt — `dragonslayer-receipt/v1`

| Field | Type | Meaning |
|---|---|---|
| `schema` | `'dragonslayer-receipt/v1'` | wire-format version |
| `gameVersion` | string | the game's package version |
| `saveVersion` | number | save-file schema version |
| `githubHandle` | string | your claimed banner (lowercased) |
| `repo.sigil` | string | sha1 of the realm's absolute path (also the save filename) |
| `repo.name` | string, optional | human realm name; **omitted entirely** when unknown |
| `day` | `YYYY-MM-DD` | the day the haul covers |
| `goldEarnedThatDay` | number ≥ 0 | the day's gold from the ledger |
| `trials[]` | array | per-trial: `trialId`, `durationMs`, `keystrokes`, `par`, `stars` (1–3), `completedAt` (epoch ms; 0 when the chronicle predates the stamp) |
| `generatedAt` | number | epoch ms the receipt was sealed |
| `contentHash` | string | sha256 hex over the canonical form (below) |

## The canonical form and `contentHash`

The hash is taken over a **stable, whitespace-free `JSON.stringify`** of every
field except `contentHash`, with keys in exactly this order:

```
schema, gameVersion, saveVersion, githubHandle,
repo { sigil, name? },        ← `name` omitted entirely when undefined
day, goldEarnedThatDay,
trials [ { trialId, durationMs, keystrokes, par, stars, completedAt } … ],
generatedAt
```

`contentHash = sha256(canonicalForm)` as lowercase hex.

**What the hash proves — and doesn't.** It is tamper-evidence: the file left
the game unedited. It is *not* an identity signature — authorship is proven by
the GitHub handle matching whoever opens the submission PR, and the boards
re-check both server-side.

### The three mirrors (cross-repo contract)

`canonicalReceipt`/`hashReceipt` exist in three places and must stay
byte-compatible:

1. **`src/ui/receipt.ts`** (this repo) — the source of truth
2. **ds-leaderboard `src/lib/receipt.ts`** — server-side validation
3. **ds-submissions `scripts/validate-receipt.mjs`** — PR validation

All three pin the same golden fixture (`dragonlord-2026-06-30.json`, digest
`172759319a063fbd7912a5dfeb33258929102650e3d54e7c8a6581ac0e91efa0`) in their
test suites, so unilateral drift breaks that repo's CI with a message naming
the other two. **Changing the canonical form is a schema change**: bump
`dragonslayer-receipt/vN` and land the fixture + mirrors in all three repos
together.

## The submission flow (summary)

```
gme leaderboard whoami --set <your-github-handle>     # once
gme leaderboard receipt --out receipts/<handle>-<YYYY-MM-DD>.json
# → open a PR to github.com/Soypete/ds-submissions adding that file
```

The PR is validated automatically (no secrets needed, forks welcome), a
maintainer's merge files the run as pending, and a moderator approves it onto
the boards after reviewing your proof media. Full rules, filename
requirements, and troubleshooting: the
[ds-submissions README](https://github.com/Soypete/ds-submissions#readme).
