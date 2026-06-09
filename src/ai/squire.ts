/// <reference types="node" />
/**
 * The Squire — forger of Claude skills.
 *
 * When a knight pledges a quest on the Guild Board, the squire rides ahead to
 * the TARGET repo and hammers out `.claude/skills/gme-<quest-slug>/SKILL.md`,
 * so the player's ordinary coding sessions know of the quest and counsel its
 * completion. The skill's words may be tailored by the great seer (the
 * `claude` CLI, summoned exactly as the oracle does: `claude -p ...
 * --output-format json`); when the seer is absent, tardy, or incoherent we
 * fall back — silently, as is tradition — to a deterministic template that is
 * genuinely useful on its own (same inputs → same bytes).
 *
 * The squire is honorable: he stamps an ownership marker into every scroll he
 * forges, REFUSES to overwrite any SKILL.md that lacks his marker, and on
 * renunciation removes only directories whose scroll bears it.
 */

import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Dragon, GameConfig, Quest, RepoScan, SkillForgeResult } from '../types.js';

/** Cap on the seer's breath (stdout), lest she flood the smithy. */
const MAX_ORACLE_BREATH_BYTES = 1024 * 1024;

/** How much of the target file's source the seer is shown (chars). */
const SOURCE_TRIBUTE_CAP = 4000;

/** Frontmatter descriptions must stay terse — the listing truncates anyway. */
const DESCRIPTION_CAP = 400;

/** Every scroll the squire forges opens its body with this brand. */
export const FORGE_MARKER_PREFIX = '<!-- gme:forged-skill';

/** Steps the guidance must hold: fewer is hand-waving, more is a lecture. */
const MIN_STEPS = 3;
const MAX_STEPS = 6;

/** The words the seer (or the template) supplies; everything else is forged. */
export interface SkillGuidance {
  /** Exactly one fantasy-flavor sentence — flavor lives here ONLY. */
  flavor: string;
  /** 3–6 numbered imperative steps tailored to the quest. */
  steps: string[];
}

// ── Naming the scroll ────────────────────────────────────────────────────────

/**
 * The skill directory name (and thus the /command): `gme-` + a kebab slug.
 * File-targeted quests slug their target path (extension shorn, a leading
 * src/app/lib dropped): `slay:src/moat-auth.ts` → `gme-slay-moat-auth`.
 * Untargeted quests slug their id: `coverage:75` → `gme-coverage-75`.
 * Deterministic — the same quest always names the same scroll.
 */
export function skillSlug(quest: Quest): string {
  const tail = quest.target !== undefined ? `${quest.kind}-${targetStem(quest.target)}` : quest.id;
  return `gme-${kebab(tail)}`;
}

/** Where the scroll lives (absolute path of the SKILL.md). */
export function skillPath(quest: Quest, cfg: GameConfig): string {
  return join(cfg.repoPath, '.claude', 'skills', skillSlug(quest), 'SKILL.md');
}

/** A target path's slug-worthy core: drop the extension and a leading src/. */
function targetStem(target: string): string {
  const shorn = target.replace(/\.[^./]+$/, '');
  const segments = shorn.split('/').filter((s) => s.length > 0);
  if (segments.length > 1 && ['src', 'app', 'lib'].includes(segments[0])) segments.shift();
  return segments.join('-');
}

/** Lowercase kebab: anything that is not [a-z0-9] becomes a single hyphen. */
function kebab(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Forging & renouncing ─────────────────────────────────────────────────────

/**
 * Forge the quest's skill into `<repo>/.claude/skills/gme-<slug>/SKILL.md`.
 * Guidance is tailored via the `claude` CLI when it answers cleanly; any
 * misfortune collapses into the deterministic template. Throws ONLY when an
 * existing SKILL.md at the destination lacks the squire's marker — that
 * scroll belongs to someone else and will not be touched.
 */
export async function forgeSkill(
  quest: Quest,
  scan: RepoScan,
  cfg: GameConfig,
  dragons: Dragon[],
  timeoutMs = 30000,
): Promise<SkillForgeResult> {
  const path = skillPath(quest, cfg);
  if (existsSync(path) && !hasForgeMarker(readFileSync(path, 'utf8'))) {
    throw new Error(
      `The squire stays his hammer: ${path} exists but bears no gme forge-marker. ` +
        'It belongs to another smith; remove it yourself if you mean to.',
    );
  }

  let guidance = fallbackGuidance(quest, scan, cfg, dragons);
  let source: SkillForgeResult['source'] = 'fallback';
  try {
    const utterance = await summonClaude(composePlea(quest, scan, cfg, dragons), timeoutMs);
    const envelope = JSON.parse(utterance) as { result?: unknown };
    if (typeof envelope.result === 'string') {
      const words = extractGuidanceJson(envelope.result);
      if (words !== null) {
        guidance = words;
        source = 'claude';
      }
    }
  } catch {
    // The seer was absent, tardy, or incomprehensible. The template abides.
  }

  const scroll = renderSkill(quest, scan, cfg, dragons, guidance);
  mkdirSync(join(cfg.repoPath, '.claude', 'skills', skillSlug(quest)), { recursive: true });
  writeFileSync(path, scroll, 'utf8');
  return { path, source };
}

/**
 * Renounce the pledge: remove the generated skill directory — but ONLY if its
 * SKILL.md bears the squire's marker. Unmarked scrolls (and absent ones) are
 * left exactly as they were found.
 */
export function renounceSkill(quest: Quest, cfg: GameConfig): void {
  const path = skillPath(quest, cfg);
  if (!existsSync(path)) return;
  if (!hasForgeMarker(readFileSync(path, 'utf8'))) return;
  rmSync(join(cfg.repoPath, '.claude', 'skills', skillSlug(quest)), {
    recursive: true,
    force: true,
  });
}

/** Does this scroll bear the squire's brand? */
export function hasForgeMarker(content: string): boolean {
  return content.includes(FORGE_MARKER_PREFIX);
}

// ── Rendering the scroll (deterministic) ─────────────────────────────────────

/**
 * Assemble the full SKILL.md. Pure: same quest/scan/cfg/dragons/guidance →
 * same bytes. Timestamps come from `scan.scannedAt`; no clocks, no dice.
 */
export function renderSkill(
  quest: Quest,
  scan: RepoScan,
  cfg: GameConfig,
  dragons: Dragon[],
  guidance: SkillGuidance,
): string {
  const lines: string[] = [
    '---',
    `name: ${skillSlug(quest)}`,
    `description: ${frontmatterDescription(quest, cfg)}`,
  ];
  if ((quest.kind === 'slay' || quest.kind === 'tdd') && quest.target !== undefined) {
    lines.push('paths:', `  - "${quest.target}"`);
  }
  lines.push(
    '---',
    `${FORGE_MARKER_PREFIX} v1 quest:${quest.id} — managed by Dragonslayer; renounce the pledge to remove -->`,
    '',
    `# ${quest.title}`,
    '',
    guidance.flavor,
    '',
    '## Objective',
    '',
    ...quest.objectives.map((o) => `- [${o.done ? 'x' : ' '}] ${o.description}`),
    `- Reward: ${quest.xpReward} XP on the next forge after the objective holds.`,
    '',
    '## Current state',
    '',
    ...currentStateBullets(quest, scan, dragons),
    '',
    '## How to complete it',
    '',
    ...guidance.steps.slice(0, MAX_STEPS).map((step, i) => `${i + 1}. ${step}`),
    '',
    '## Verify',
    '',
    '```bash',
    ...verifyCommands(quest, cfg),
    '```',
    '',
    'The quest completes on the next forge (`f` in the game), which reruns the scan above.',
    '',
  );
  return lines.join('\n');
}

/**
 * The sole triggering mechanism: third person, key use case first, the
 * literal trigger keywords baked in (target path for slay/tdd, "CI workflow"
 * for ci, "playwright" for e2e), plus the quest title. Capped hard.
 */
function frontmatterDescription(quest: Quest, cfg: GameConfig): string {
  const title = quest.title;
  let description: string;
  switch (quest.kind) {
    case 'slay':
      description =
        `Guides writing tests for ${quest.target} to complete the Dragonslayer quest "${title}". ` +
        `Use whenever ${quest.target} is edited, tested, refactored, or discussed, or when raising ` +
        'its coverage — even if the quest is not mentioned.';
      break;
    case 'tdd':
      description =
        `Guides the Dragonslayer quest "${title}": grow the test suite — the test count must rise` +
        `${quest.target !== undefined ? `, starting with ${quest.target}` : ''}. ` +
        'Use whenever tests, test files, TDD, or coverage come up in this repo — even in passing.';
      break;
    case 'coverage':
      description =
        `Guides the Dragonslayer quest "${title}": raise total line coverage. ` +
        'Use whenever coverage, untested files, or writing tests comes up in this repo ' +
        `(e.g. running ${cfg.coverageCommand}) — even if the quest is not mentioned.`;
      break;
    case 'ci':
      description =
        `Guides the Dragonslayer quest "${title}": add a CI workflow under .github/workflows that ` +
        'runs the tests. Use whenever CI, GitHub Actions, workflows, or pipelines come up — even ' +
        'if the quest is not mentioned.';
      break;
    case 'e2e':
      description =
        `Guides the Dragonslayer quest "${title}": configure playwright and add at least one ` +
        'end-to-end spec. Use whenever e2e, end-to-end, browser tests, or playwright come up — ' +
        'even if the quest is not mentioned.';
      break;
    default:
      description =
        `Guides the Dragonslayer quest "${title}". Use whenever tests or coverage come up in ` +
        'this repo — even if the quest is not mentioned.';
  }
  return description.length > DESCRIPTION_CAP
    ? `${description.slice(0, DESCRIPTION_CAP - 1)}…`
    : description;
}

/** The real scan facts, as bullets. Honest numbers only; no flavor here. */
function currentStateBullets(quest: Quest, scan: RepoScan, dragons: Dragon[]): string[] {
  const bullets: string[] = [];
  const dragon = quest.target !== undefined ? findDragon(dragons, quest.target) : undefined;
  if (dragon !== undefined) {
    bullets.push(
      `- ${dragon.file}: ${dragon.coveragePct}% line coverage, ${dragon.hp} uncovered ` +
        `line${dragon.hp === 1 ? '' : 's'} (the dragon's remaining HP).`,
    );
    const wards = nearbyTests(dragon.file, scan.testFiles);
    bullets.push(
      wards.length > 0
        ? `- Existing tests that name it: ${wards.join(', ')}.`
        : '- No test file names it yet.',
    );
  }
  bullets.push(
    `- Repo totals: ${totalCoverageLabel(scan)}; ${scan.testFiles.length} test ` +
      `file${scan.testFiles.length === 1 ? '' : 's'}, ${scan.sourceFiles.length} source files.`,
  );
  if (quest.kind === 'coverage' || quest.kind === 'tdd') {
    const menaces = livingByHp(dragons).slice(0, 3);
    if (menaces.length > 0) {
      bullets.push(
        `- Biggest untested files: ${menaces
          .map((d) => `${d.file} (${d.hp} uncovered lines)`)
          .join(', ')}.`,
      );
    }
  }
  if (quest.kind === 'ci') {
    bullets.push(
      scan.ci.workflows.length > 0
        ? `- CI workflows present: ${scan.ci.workflows.join(', ')} — ` +
            `${scan.ci.hasTestJob ? 'a test job was detected' : 'no test job detected yet'}.`
        : '- No CI workflows exist yet (.github/workflows is empty or absent).',
    );
  }
  if (quest.kind === 'e2e') {
    bullets.push(
      scan.playwright.configured
        ? `- Playwright is configured (${scan.playwright.configPath ?? 'config found'}) with ` +
            `${scan.playwright.specCount} spec${scan.playwright.specCount === 1 ? '' : 's'}.`
        : '- Playwright is not configured yet (no playwright.config.* found).',
    );
  }
  bullets.push(`- Last scanned: ${new Date(scan.scannedAt).toISOString()}.`);
  return bullets;
}

/** The repo's REAL commands, verbatim, for the fenced Verify block. */
function verifyCommands(quest: Quest, cfg: GameConfig): string[] {
  const commands = [cfg.testCommand, cfg.coverageCommand];
  if (quest.kind === 'e2e' && cfg.e2eCommand !== undefined) commands.push(cfg.e2eCommand);
  return [...new Set(commands)];
}

/** Human label for total line coverage, honest about a missing report. */
function totalCoverageLabel(scan: RepoScan): string {
  return scan.coverage !== null
    ? `${scan.coverage.totals.lines.pct}% total line coverage`
    : 'no coverage report found yet';
}

// ── The deterministic template (the fallback that must stand alone) ──────────

/**
 * The squire's own counsel, spoken when the seer will not. Tailored to the
 * quest kind with the repo's real numbers, frameworks, and commands —
 * genuinely useful, never generic. Deterministic.
 */
export function fallbackGuidance(
  quest: Quest,
  scan: RepoScan,
  cfg: GameConfig,
  dragons: Dragon[],
): SkillGuidance {
  const framework = detectFramework(cfg);
  const dragon = quest.target !== undefined ? findDragon(dragons, quest.target) : undefined;
  switch (quest.kind) {
    case 'slay':
      return slayGuidance(quest, scan, cfg, framework, dragon);
    case 'tdd':
      return {
        flavor: 'The armory grows only when new ward-scrolls are forged — one honest test at a time.',
        steps: [
          `Pick an untested file to start with${topMenaceClause(dragons)}.`,
          `Write a failing ${framework} test that names the behavior you expect, and run \`${cfg.testCommand}\` to watch it fail.`,
          'Make the test pass with the smallest change that could work, then refactor with the test green.',
          `Repeat in a NEW test file so the repo's test-file count rises above its baseline (currently ${scan.testFiles.length}).`,
        ],
      };
    case 'coverage':
      return {
        flavor: `The realm's wards stand at ${scan.coverage?.totals.lines.pct ?? 0}% — the guild charter demands more.`,
        steps: [
          `Strike the biggest lairs first${topMenaceClause(dragons)}.`,
          `Add ${framework} tests for each file's uncovered exports and branches — error paths and edge cases hide most of the bare lines.`,
          `Run \`${cfg.coverageCommand}\` and read the per-file lines column to confirm each file you touched climbed.`,
          'Repeat down the list until the total line coverage in the report clears the quest threshold.',
        ],
      };
    case 'ci':
      return {
        flavor: 'A castle without sentries falls in the night; a workflow keeps the watch while you sleep.',
        steps: [
          'Create `.github/workflows/test.yml` triggered on `push` and `pull_request`.',
          `Give the job four steps: checkout, set up Node, install dependencies, then run \`${cfg.testCommand}\`.`,
          'Commit the workflow file — the scan detects a test job by spotting test/vitest/jest/playwright in the workflow text.',
          'Push (or run it locally) once to confirm the YAML parses and the suite passes in a clean clone.',
        ],
      };
    case 'e2e':
      return {
        flavor: 'The final gauntlet marches the whole keep from gatehouse to throne room in one breath.',
        steps: [
          scan.playwright.configured
            ? `Playwright is already configured (${scan.playwright.configPath ?? 'config found'}); open its config to see where specs are expected.`
            : 'Add a `playwright.config.ts` at the repo root pointing `testDir` at an `e2e/` directory.',
          'Write at least one `*.spec.ts` that walks a real user journey end to end and asserts on what the user would see.',
          `Run the suite with \`${cfg.e2eCommand ?? 'npx playwright test'}\` until it passes.`,
          'Keep the spec deterministic: no sleeps, no live network — use Playwright auto-waiting and fixtures.',
        ],
      };
    default:
      return {
        flavor: 'The guild board creaks; this quest keeps its own counsel, but the rites below still apply.',
        steps: [
          'Read the objective checklist above and identify which condition is not yet met.',
          `Make the smallest real change that satisfies it, guarded by a ${framework} test.`,
          `Run \`${cfg.testCommand}\` and the coverage command below to confirm nothing regressed.`,
        ],
      };
  }
}

/** The slay template: the file, its dragon, and where the wards should go. */
function slayGuidance(
  quest: Quest,
  scan: RepoScan,
  cfg: GameConfig,
  framework: string,
  dragon: Dragon | undefined,
): SkillGuidance {
  const target = quest.target ?? 'the target file';
  const flavor =
    dragon !== undefined
      ? `${dragon.name} the ${dragon.species} coils atop ${target}, and only true tests pierce its hide.`
      : `A dragon coils atop ${target}, and only true tests pierce its hide.`;
  const wards = quest.target !== undefined ? nearbyTests(quest.target, scan.testFiles) : [];
  const testHome =
    wards.length > 0
      ? `Extend ${wards[0]}`
      : `Create ${suggestTestPath(target, scan.testFiles)}`;
  const hpClause =
    dragon !== undefined
      ? ` — the coverage report counts ${dragon.hp} uncovered line${dragon.hp === 1 ? '' : 's'} there (${dragon.coveragePct}% covered)`
      : '';
  return {
    flavor,
    steps: [
      `Read ${target} and list its exported functions and branches${hpClause}.`,
      `${testHome} with ${framework} tests: one describe block per export, one test per behavior.`,
      'Cover the error paths and edge branches first — uncovered lines usually hide there.',
      `Run \`${cfg.coverageCommand}\` and check the report until ${target} shows 100% line coverage.`,
    ],
  };
}

/** Name the top living dragons inline, e.g. " — src/a.ts (97 uncovered lines)". */
function topMenaceClause(dragons: Dragon[]): string {
  const menaces = livingByHp(dragons).slice(0, 3);
  if (menaces.length === 0) return '';
  return `: ${menaces.map((d) => `${d.file} (${d.hp} uncovered lines)`).join(', ')}`;
}

/** Living dragons, biggest first; ties broken by path so counsel never wavers. */
function livingByHp(dragons: Dragon[]): Dragon[] {
  return dragons
    .filter((d) => !d.slain && d.hp > 0)
    .sort((a, b) => b.hp - a.hp || a.file.localeCompare(b.file));
}

/** The dragon whose lair is this file, if any. */
function findDragon(dragons: Dragon[], target: string): Dragon | undefined {
  return dragons.find((d) => d.id === target || d.file === target);
}

/** Which test framework the repo's own commands confess to. */
function detectFramework(cfg: GameConfig): string {
  const commands = `${cfg.testCommand} ${cfg.coverageCommand}`;
  if (/vitest/i.test(commands)) return 'vitest';
  if (/\bjest\b/i.test(commands)) return 'jest';
  if (/\bmocha\b/i.test(commands)) return 'mocha';
  if (/\bnode\b.*--test|node:test/i.test(commands)) return 'node:test';
  return 'the configured test runner';
}

/** Test files whose names invoke the target's basename (capped at 3). */
function nearbyTests(target: string, testFiles: string[]): string[] {
  const basename = target.split('/').pop() ?? target;
  const stem = basename.replace(/\.[^.]+$/, '');
  if (stem.length === 0) return [];
  return testFiles.filter((t) => (t.split('/').pop() ?? t).includes(stem)).slice(0, 3);
}

/** Where a brand-new test for this file should live, by repo convention. */
function suggestTestPath(target: string, testFiles: string[]): string {
  const extMatch = /\.([^./]+)$/.exec(target);
  const ext = extMatch !== null ? extMatch[1] : 'ts';
  const stem = (target.split('/').pop() ?? target).replace(/\.[^.]+$/, '');
  const testsDir = testFiles.find((t) => /^tests?\//.test(t))?.split('/')[0];
  if (testsDir !== undefined) return `${testsDir}/${stem}.test.${ext}`;
  return target.replace(/\.[^./]+$/, `.test.${ext}`);
}

// ── Consulting the seer ──────────────────────────────────────────────────────

/** Run the claude CLI directly (no shell), resolving with its stdout. */
function summonClaude(plea: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'claude',
      ['-p', plea, '--output-format', 'json'],
      { timeout: timeoutMs, maxBuffer: MAX_ORACLE_BREATH_BYTES },
      (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout);
      },
    );
  });
}

/**
 * Compose the plea laid on the anvil: the quest, the real scan facts, the
 * repo's true commands, and (for file-targeted quests) the target's actual
 * source, capped so the tribute stays modest.
 */
function composePlea(quest: Quest, scan: RepoScan, cfg: GameConfig, dragons: Dragon[]): string {
  const dragon = quest.target !== undefined ? findDragon(dragons, quest.target) : undefined;
  const facts = [
    `Quest: "${quest.title}" (kind: ${quest.kind}) — ${quest.description}`,
    `Objectives: ${quest.objectives.map((o) => o.description).join('; ')}`,
    dragon !== undefined
      ? `Target file ${dragon.file}: ${dragon.coveragePct}% line coverage, ${dragon.hp} uncovered lines.`
      : null,
    `Repo: ${totalCoverageLabel(scan)}; ${scan.testFiles.length} test files; ` +
      `CI workflows: ${scan.ci.workflows.length}; playwright configured: ${scan.playwright.configured}.`,
    `Test command: ${cfg.testCommand}`,
    `Coverage command: ${cfg.coverageCommand}`,
    cfg.e2eCommand !== undefined ? `E2E command: ${cfg.e2eCommand}` : null,
  ].filter((line): line is string => line !== null);

  const source = readTargetSource(quest, cfg);
  return [
    'You are the Squire in a fantasy RPG about code reliability (bugs are dragons,',
    'tests are wards). A quest skill file is being forged into the repo so coding',
    'sessions there can complete the quest. You supply ONLY two things: one fantasy',
    'flavor sentence, and 3-6 numbered imperative how-to steps.',
    '',
    ...facts,
    ...(source !== null ? ['', 'Target file source (capped):', '```', source, '```'] : []),
    '',
    'Respond with ONLY a JSON object, no prose, of the shape:',
    '{"flavor":"<one fantasy sentence>","steps":["<imperative step>", "..."]}',
    '',
    'Rules for steps: concrete and tailored to THIS repo (its real frameworks, paths,',
    'and the commands above) — never generic advice; one instruction per step; include',
    'commands only when they are the configured repo commands or standard invocations',
    'of detected frameworks; no fantasy flavor inside the steps.',
  ].join('\n');
}

/** Read the target file's source for the plea; absence is no misfortune. */
function readTargetSource(quest: Quest, cfg: GameConfig): string | null {
  if (quest.target === undefined) return null;
  try {
    const text = readFileSync(join(cfg.repoPath, quest.target), 'utf8');
    return text.length > SOURCE_TRIBUTE_CAP ? `${text.slice(0, SOURCE_TRIBUTE_CAP)}\n…` : text;
  } catch {
    return null;
  }
}

// ── Reading the entrails (JSON extraction) ───────────────────────────────────

/**
 * Pull {flavor, steps} out of the seer's raw utterance. Tolerates fenced code
 * blocks and stray prose around the braces. Returns null when no well-formed
 * guidance can be divined (wrong shape, or fewer than 3 / more than 6 steps).
 */
export function extractGuidanceJson(utterance: string): SkillGuidance | null {
  for (const rune of candidateRunes(utterance)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rune);
    } catch {
      continue;
    }
    const guidance = sanctifyGuidance(parsed);
    if (guidance !== null) return guidance;
  }
  return null;
}

/** Candidate JSON texts hidden in the utterance, most-likely first. */
function* candidateRunes(utterance: string): Generator<string> {
  const trimmed = utterance.trim();
  if (trimmed.length === 0) return;
  yield trimmed;

  const fences = trimmed.matchAll(/```(?:json)?\s*\n?([\s\S]*?)```/gi);
  for (const fence of fences) {
    const body = fence[1].trim();
    if (body.length > 0) yield body;
  }

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last > first) yield trimmed.slice(first, last + 1);
}

/** Validate an arbitrary parsed value into guidance, or reject it (null). */
function sanctifyGuidance(parsed: unknown): SkillGuidance | null {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const { flavor, steps } = parsed as Record<string, unknown>;
  if (typeof flavor !== 'string' || flavor.trim().length === 0) return null;
  if (!Array.isArray(steps) || steps.length < MIN_STEPS || steps.length > MAX_STEPS) return null;
  const blessed: string[] = [];
  for (const step of steps) {
    if (typeof step !== 'string' || step.trim().length === 0) return null;
    blessed.push(step.trim().replace(/\s+/g, ' '));
  }
  return { flavor: flavor.trim().replace(/\s+/g, ' '), steps: blessed };
}
