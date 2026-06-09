# Claude Skills Research — for the Squire's Forge

Research notes backing `src/ai/squire.ts` (`forgeSkill`) and the Guild Shop's
"Forge a Claude skill" purchase. Sources: the official Claude Code skills docs,
the `anthropics/skills` repo (incl. `skill-creator`), Anthropic's engineering
post on Agent Skills, and community "awesome" collections. Verified 2026-06-09.

- Official docs: https://code.claude.com/docs/en/skills
- Official repo: https://github.com/anthropics/skills (spec in `./spec/`, template in `./template/`)
- Open standard: https://agentskills.io
- Engineering post: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills

---

## 1. Canonical SKILL.md anatomy

A skill is a **directory** whose entrypoint is `SKILL.md`:

```text
<repo>/.claude/skills/<skill-name>/
├── SKILL.md           # required — frontmatter + instructions
├── reference.md       # optional — loaded only when needed
├── examples/…         # optional — expected-output samples
└── scripts/…          # optional — executed, never loaded into context
```

The **directory name becomes the slash command** (`.claude/skills/gme-slay-vexmaw/SKILL.md`
→ `/gme-slay-vexmaw`). Kebab-case, lowercase. The frontmatter `name` is only a
display label in listings (except for plugin-root skills).

### Frontmatter (YAML between `---` markers)

All fields are optional; `description` is the one that matters. Fields relevant
to forged quest skills:

| Field | Notes |
| :--- | :--- |
| `name` | Display name in listings; defaults to directory name. Kebab-case. |
| `description` | **The triggering mechanism.** What the skill does AND when to use it. Claude reads only this (plus `when_to_use`) when deciding to load the skill; combined text truncated at **1,536 chars** in the listing — front-load the key use case. |
| `when_to_use` | Extra trigger phrases / example requests; appended to description, same cap. |
| `paths` | Globs that scope auto-activation to matching files — ideal for file-targeted `slay`/`tdd` quests (e.g. `src/moat/auth.ts`). |
| `allowed-tools` | Pre-approved tools while active, e.g. `Bash(npx vitest *)`. Takes effect only after the user trusts the workspace — fine to set, never rely on it. |
| `disable-model-invocation` | `true` = manual-only (`/name`). Forged quest skills should **omit it**: the whole point is that Claude picks the quest up during normal coding sessions. |
| `user-invocable` | `false` hides from the `/` menu (background knowledge). Quest skills stay invocable. |
| `context: fork` / `agent` | Run in an isolated subagent. Not for quest skills — they are reference + task content meant to run inline with the player's session. |
| `argument-hint`, `arguments` | `$ARGUMENTS`/`$0…` substitution. Not needed for quest skills. |

Dynamic context injection exists (`` !`command` `` runs at load time and inlines
the output) but forged skills should NOT use it: the squire bakes real scan data
in at forge time instead, which works in every harness and never executes shell
on the player's behalf.

### Body conventions

- Markdown instructions Claude follows once the skill loads. The body enters
  context **once per invocation and stays for the session** — every line is a
  recurring token cost. Write standing instructions, not one-time narration.
- Official cap: **keep SKILL.md under 500 lines**; move long reference material
  to supporting files and link them with a note about when to read each.
- Imperative voice ("Write a failing test", "Run the coverage command").
- Define done-states and output formats explicitly; show concrete commands in
  fenced code blocks.

### Progressive disclosure (the three levels)

1. **Metadata** (`name` + `description`) — always in context at session start
   (~100 words budget per skill). This alone decides triggering.
2. **SKILL.md body** — loaded when the skill triggers (< 500 lines).
3. **Supporting files** — loaded only when the body points Claude at them.

Forged quest skills are small enough to live entirely at levels 1–2.

### What makes descriptions trigger well

- State **what the skill does AND the specific contexts to use it in**, third
  person: "Use when the user edits `src/moat/auth.ts`, mentions coverage, or
  writes tests."
- Be **pushy** — models undertrigger skills. skill-creator's own advice:
  "Make sure to use this skill whenever the user mentions X, even if they
  don't explicitly ask for it."
- Put ALL when-to-use information in the description, none of it only in the
  body (the body isn't read until after the trigger decision).
- Include the literal keywords a user would type: file paths, "coverage",
  "tests", "CI", the quest name.
- Front-load: truncation at 1,536 chars (and tighter budgets when many skills
  are installed) strips the tail first.
- Troubleshooting flips: triggers too often → make the description more
  specific; never triggers → add natural-language keywords, test by asking
  "What skills are available?".

---

## 2. Template guidance for squire-forged quest skills

Concrete rules for `forgeSkill(quest, scan, cfg, dragons)` — both the
`claude -p` prompt and the deterministic fallback template must produce this
shape:

### Directory + frontmatter

```yaml
# .claude/skills/gme-<quest-slug>/SKILL.md
---
name: gme-<quest-slug>
description: >-
  <What: one clause naming the quest objective with real numbers.>
  Use when working in <target file / this repo>, writing or improving tests,
  or when the user mentions coverage, <basename>, or the "<quest title>" quest.
---
```

- `description` ≤ ~400 chars, key use case first, includes the target file
  path verbatim (slay/tdd) or "CI workflow"/"playwright" (ci/e2e) as trigger
  keywords.
- For `slay`/`tdd` quests add `paths:` with the target file glob so the skill
  auto-activates when the player touches that file.
- No `disable-model-invocation`, no `context: fork`, no `$ARGUMENTS`.

### Ownership marker (required)

First body line, immediately after the frontmatter:

```markdown
<!-- gme:forged-skill v1 quest:<quest-id> — managed by Dragonslayer; renounce the pledge to remove -->
```

`forgeSkill` must refuse to overwrite any SKILL.md lacking this marker, and
renouncing a pledge deletes only marker-bearing skill dirs.

### Body — fixed section order, ≤ ~80 lines total

1. **`# <Quest title>`** + one flavor sentence (fantasy voice lives here and
   only here — one line, not sprinkled through the instructions).
2. **`## Objective`** — the quest objective(s) as a checklist, with the real
   completion condition ("`src/moat/auth.ts` reaches 100% line coverage").
3. **`## Current state`** — real scan data at forge time: coverage %, uncovered
   line count (dragon hp), existing test files near the target, whether CI /
   playwright exist. Bulleted facts, no prose.
4. **`## How to complete it`** — 3–6 numbered imperative steps tailored to the
   quest kind (write vitest tests for the named uncovered functions; add a
   `test` job to `.github/workflows/...`; add a playwright spec under `e2e/`).
   Steps reference the repo's actual frameworks, never generic advice.
5. **`## Verify`** — the repo's REAL commands from `GameConfig`, verbatim, in a
   fenced `bash` block (`testCommand`, `coverageCommand`, `e2eCommand` when
   relevant), plus one line: "the quest completes on the next forge (`f` in
   the game)."

### Dos

- Imperative voice throughout; one instruction per step.
- Include commands **only** when they are the configured repo commands or
  standard invocations of frameworks the scan actually detected — always in
  fenced blocks, copy-paste runnable from the repo root.
- Bake real numbers in (uncovered lines, current %, test-file count); a forged
  skill with stale-but-real data beats a fresh-but-generic one.
- Brief "why" where it earns its tokens (skill-creator: appeal to reasoning,
  e.g. "test the uncovered branches first — they are where the dragon hides").
- Keep the fallback template fully deterministic: same inputs → same bytes
  (no Date.now, no randomness; timestamps come from `scan.scannedAt`).

### Don'ts

- No ALL-CAPS shouting (MUST/NEVER walls) — explain instead.
- No `!`command`` dynamic injection, no bundled scripts, no supporting files —
  forged skills are single-file by design.
- Don't restate when-to-use in the body (it belongs in the description).
- Don't exceed ~80 body lines (official limit is 500; generated skills should
  be far leaner since they ride along in every session in the target repo).
- Don't overwrite unmarked SKILL.md files; don't write outside
  `<targetRepo>/.claude/skills/gme-*`.
- Don't let fantasy flavor displace facts — one flavor line, then engineering.

---

## 3. Curated public skills (guild-shop inventory candidates)

Existing high-quality skills matching this game's quest kinds. All URLs
verified live 2026-06-09.

| # | Skill | Quest fit | URL |
| :- | :--- | :--- | :--- |
| 1 | `test-driven-development` (obra/superpowers) | `tdd` | https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md |
| 2 | `webapp-testing` (anthropics/skills, official) | `e2e` | https://github.com/anthropics/skills/tree/main/skills/webapp-testing |
| 3 | `playwright-skill` (lackeyjb, ~2.7k★) | `e2e` | https://github.com/lackeyjb/playwright-skill |
| 4 | `e2e-test-writing` (Shopify/hydrogen, in-repo) | `e2e` | https://github.com/Shopify/hydrogen/blob/main/.claude/skills/e2e-test-writing/SKILL.md |
| 5 | `test-skills` (agentmantis) | `e2e`/`coverage` | https://github.com/agentmantis/test-skills |
| 6 | `systematic-debugging` (obra/superpowers) | `slay` | https://github.com/obra/superpowers/blob/main/skills/systematic-debugging/SKILL.md |
| 7 | `github-actions-security-cheat-sheet` (adaptive-enforcement-lab) | `ci` | https://github.com/adaptive-enforcement-lab/claude-skills/tree/main/plugins/secure/skills/github-actions-security-cheat-sheet |
| 8 | `skill-creator` (anthropics/skills, official) | meta — squire's template source | https://github.com/anthropics/skills/tree/main/skills/skill-creator |
| 9 | `writing-skills` (obra/superpowers) | meta — skill quality bar | https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md |
| 10 | awesome-claude-code (hesreallyhim) + awesome-agent-skills (VoltAgent) | discovery hubs | https://github.com/hesreallyhim/awesome-claude-code · https://github.com/VoltAgent/awesome-agent-skills |

Why each fits:

1. **superpowers/test-driven-development** — the strongest enforcement-style
   testing skill in the wild: Iron Law ("no production code without a failing
   test"), red/green/refactor flowchart, rationalization table, verification
   checklist. Direct model for the `tdd` quest ("the test count must rise")
   and the structural gold standard the squire's template imitates.
2. **anthropics/webapp-testing** — the official Playwright-driven webapp
   testing skill; Apache-2.0; the safest thing to recommend when the `e2e`
   quest fires and the target repo has no Playwright yet.
3. **lackeyjb/playwright-skill** — most-starred community Playwright skill;
   exemplary progressive disclosure (lean SKILL.md, full API reference loaded
   on demand). Good inventory for "playwright configured, specs needed".
4. **Shopify/hydrogen e2e-test-writing** — a production repo's in-repo
   `.claude/skills/` skill: role-based accessibility-first selectors, assert
   user-visible behavior, no arbitrary timeouts. This is exactly the artifact
   shape `forgeSkill` produces (project-scoped skill committed to the target
   repo), so it doubles as a reference implementation.
5. **agentmantis/test-skills** — full Playwright test lifecycle (scaffolding,
   Page Object Models, regression management) for agents; pairs with the
   `e2e` quest when the player wants more than one spec.
6. **superpowers/systematic-debugging** — root-cause-first debugging method;
   maps to `slay` quests, where killing a dragon means understanding the
   untested file well enough to pin it down with tests.
7. **adaptive-enforcement-lab github-actions-security-cheat-sheet** —
   copy-pasteable SHA pinning, least-privilege `permissions:`, workflow
   hardening. Fits the `ci` quest's "workflows exist + hasTestJob" objective
   and hardens what the quest creates.
8. **anthropics/skill-creator** — the official meta-skill whose authoring
   rules (pushy descriptions, <500-line bodies, imperative voice, three-level
   disclosure) section 2 of this doc distills; the squire prompt should cite
   its rules.
9. **superpowers/writing-skills** — community meta-skill on writing skills
   that actually change agent behavior (requires understanding TDD skill
   first); a second opinion for the squire's quality bar.
10. **awesome-claude-code / awesome-agent-skills** — the two healthiest
    curated indexes (the latter 1000+ skills across agents); where the guild
    shop looks when a quest kind has no in-house inventory.

**Gap found:** no quality public skill exists for vim-motion or typing
practice (searches returned only Claude Code's own vim *input mode* docs).
The sword-school stays an in-engine feature; nothing worth linking.

---

## 4. Source list

- https://code.claude.com/docs/en/skills — full frontmatter reference, 1,536-char description cap, 500-line body tip, lifecycle/compaction behavior, triggering troubleshooting.
- https://github.com/anthropics/skills — official repo: `skills/` (17 incl. webapp-testing, skill-creator, mcp-builder), `spec/`, `template/`; Apache-2.0 except document skills.
- https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills — three-level progressive disclosure, iterate-from-transcripts advice.
- https://support.claude.com/en/articles/12512198-creating-custom-skills — authoring how-to referenced by the official repo.
- https://agentskills.io — the cross-tool Agent Skills standard Claude Code implements.
- Community indexes: hesreallyhim/awesome-claude-code, VoltAgent/awesome-agent-skills, ComposioHQ/awesome-claude-skills, travisvn/awesome-claude-skills.
