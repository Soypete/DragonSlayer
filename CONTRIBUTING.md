# Contributing to Dragonslayer

Welcome to the guild. This game is about making code reliable, so the
contribution rules are the game played on itself: tested, typed, repeatable.

## Setup

```bash
git clone git@github.com:Soypete/DragonSlayer.git && cd DragonSlayer
npm install
npm run dev:dungeon   # you should be on the title screen in seconds
```

Node 22+ required (developed on 24). No other tooling, no accounts, no env vars.

New to the game itself? The [README](README.md) covers how to play, how to
point the game at your own repo, and how every point of XP and gold is earned
("Winning points") — read it before changing game balance.

## Finding work

Check the [issue tracker](https://github.com/Soypete/DragonSlayer/issues) —
issues labeled **good first issue** are scoped for newcomers. Comment on an
issue before starting so two knights don't ride at the same dragon. Balance
complaints, playtest notes, and tutorial gaps are all first-class quests.

## The laws of the realm

1. **Tests ride with every change.** New logic ships with vitest coverage;
   bug fixes ship with the test that would have caught them. `npm test` and
   `npm run typecheck` must both pass — a PR that lowers coverage feeds the
   dragons we're sworn to slay.
2. **Respect the contract.** All shared domain types live in `src/types.ts`,
   and modules (`src/game`, `src/repo`, `src/typing`, `src/ai`, `src/vim`)
   import *only* from there plus node builtins and installed deps — never from
   each other. Only `src/ui` and `src/index.tsx` wire modules together. Read
   [ARCHITECTURE.md](ARCHITECTURE.md) before adding a module; it is binding.
3. **Pure logic stays pure.** No `Math.random()`, no clock reads inside
   reducers or generators — seeds and timestamps come in as parameters.
   Deterministic functions are why saves stay stable and tests stay honest.
4. **Everything stays local.** No telemetry, no network calls, no auth. The
   only subprocesses are the player's configured test commands and the
   optional local `claude` CLI. PRs adding network dependencies will be
   turned away at the drawbridge.
5. **ESM discipline.** `"type": "module"` with NodeNext resolution — relative
   imports use `.js` extensions even in `.ts` files.
6. **Flavor is part of the spec.** Player-facing strings live in the fantasy
   register (dragons, forges, oaths) — but never at the cost of clarity. If a
   novice can't tell what a screen wants from them, the flavor failed. When in
   doubt: plain meaning first, garnish second.
7. **The player is learning.** Tutorials, hints, and explanations are
   features, not chores. Anything that adds a mechanic must teach it
   (lesson text, footer hints, or a debrief).
8. **Minigames must sharpen a real skill.** Every minigame contribution has
   to train something that makes you better at building software — typing,
   vim motions, reading unfamiliar code, writing tests, debugging, CI/CD,
   shell fluency. Fun is required; fun *alone* is not. If the skill it
   teaches can't be named in one sentence, it doesn't enter the realm.
9. **Code owners hold the gate.** Every change lands only with code-owner
   approval (see `.github/CODEOWNERS`) — no self-merges, no exceptions.

## Pull requests

- Branch from `main`; keep PRs focused on one quest at a time.
- PRs land by **squash or rebase only** — merge commits are disabled and
  `main` requires linear history. Your PR title becomes the commit title, so
  write it like one. Merged branches are deleted automatically.
- Describe what changed and how you verified it (test output beats prose).
- Screenshots/casts encouraged for UI changes — it's a terminal game; show
  the terminal.
- Don't commit save files, `coverage/`, or anything from `~/.gme` (the
  `.gitignore` guards this, but see law 4 about what belongs in the repo).

## Filing issues

Bug reports: include your terminal, Node version, the repo you pointed the
game at, and what the screen showed. Balance complaints (too grindy, damage
weird, pars unfair) are first-class issues — this game is tuned by playtest.

## Code of conduct

Be the kind of knight other people want in their party. Newcomers learning
vim, typing, or testing are the entire point of this game — condescension is
the one dragon we slay on sight.

## Spread the word

Playing more than contributing? That helps too — share your daily campaign
stats (rank, XP, coverage %, dragons slain) on Discord or socials with
**#PeteTheDragonSlayer** so other knights can find the guild.
