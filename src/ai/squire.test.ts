/**
 * Trials of the Squire.
 *
 * The real `claude` CLI is never summoned here: `node:child_process` is
 * mocked, so the claude-path tests feed canned utterances and the fallback
 * tests feed only misfortune. Skills are forged into a temp-dir keep that is
 * razed after every test.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dragon, GameConfig, Quest, RepoScan } from '../types.js';
import {
  FORGE_MARKER_PREFIX,
  extractGuidanceJson,
  fallbackGuidance,
  forgeSkill,
  hasForgeMarker,
  renderSkill,
  renounceSkill,
  skillPath,
  skillSlug,
} from './squire.js';

vi.mock('node:child_process', () => ({ execFile: vi.fn() }));
import { execFile } from 'node:child_process';

const execFileMock = vi.mocked(execFile);

type ExecCallback = (err: Error | null, stdout: string, stderr: string) => void;

/** Script the mocked seer: decide what the `claude` CLI appears to say. */
function stubClaude(behavior: (cb: ExecCallback) => void): void {
  execFileMock.mockImplementation(((...args: unknown[]) => {
    const cb = args[args.length - 1] as ExecCallback;
    behavior(cb);
    return undefined as never;
  }) as never);
}

/** The seer is simply absent (binary missing) — the template must abide. */
function absentSeer(): void {
  stubClaude((cb) => cb(new Error('ENOENT: claude not found'), '', ''));
}

// ── Fixture forging ──────────────────────────────────────────────────────────

let keep: string; // the temp-dir target repo

beforeEach(() => {
  keep = mkdtempSync(join(tmpdir(), 'gme-squire-'));
  absentSeer();
});

afterEach(() => {
  rmSync(keep, { recursive: true, force: true });
  vi.clearAllMocks();
});

function forgeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'slay:src/moat-auth.ts',
    kind: 'slay',
    title: 'Slay Vexmaw the Untested',
    description: 'The Null Drake guards 42 uncovered lines.',
    objectives: [
      {
        id: 'slay:src/moat-auth.ts:full-coverage',
        description: 'Bring src/moat-auth.ts to 100% line coverage.',
        done: false,
      },
    ],
    xpReward: 120,
    status: 'active',
    target: 'src/moat-auth.ts',
    ...overrides,
  };
}

function forgeDragon(overrides: Partial<Dragon> & { file: string }): Dragon {
  return {
    id: overrides.file,
    name: 'Vexmaw',
    species: 'Null Drake',
    maxHp: 42,
    hp: 42,
    weakened: 0,
    slain: false,
    coveragePct: 31,
    ...overrides,
  };
}

function forgeScan(overrides: Partial<RepoScan> = {}): RepoScan {
  return {
    repoPath: keep,
    coverage: {
      files: [],
      totals: {
        lines: { total: 200, covered: 110, pct: 55 },
        statements: { total: 200, covered: 110, pct: 55 },
        functions: { total: 40, covered: 20, pct: 50 },
        branches: { total: 60, covered: 30, pct: 50 },
      },
      source: 'coverage/coverage-summary.json',
      generatedAt: 1717000000000,
    },
    playwright: { configured: false, specCount: 0 },
    ci: { workflows: [], hasTestJob: false },
    sourceFiles: ['src/moat-auth.ts', 'src/drawbridge.ts'],
    testFiles: ['tests/drawbridge.test.ts'],
    scannedAt: 1717000000000,
    ...overrides,
  };
}

function forgeConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    repoPath: keep,
    testCommand: 'npx vitest run',
    coverageCommand: 'npx vitest run --coverage',
    coverageSummaryGlobs: ['coverage/coverage-summary.json'],
    sourceGlobs: ['src/**/*.ts'],
    excludeGlobs: ['**/*.test.ts'],
    ...overrides,
  };
}

const GUIDANCE_JSON =
  '{"flavor":"The seer hums over the anvil.","steps":["Read the lair map.","Forge the wards.","Run the rite."]}';

function envelope(result: string): string {
  return JSON.stringify({ result });
}

// ── Naming the scroll ────────────────────────────────────────────────────────

describe('skillSlug — the scroll is named once and forever', () => {
  it('slugs a slay quest from its target, dropping src/ and the extension', () => {
    expect(skillSlug(forgeQuest())).toBe('gme-slay-moat-auth');
  });

  it('slugs nested targets with every remaining segment', () => {
    const quest = forgeQuest({ id: 'slay:src/moat/auth.ts', target: 'src/moat/auth.ts' });
    expect(skillSlug(quest)).toBe('gme-slay-moat-auth');
  });

  it('slugs untargeted quests from their id', () => {
    expect(skillSlug(forgeQuest({ id: 'coverage:75', kind: 'coverage', target: undefined }))).toBe(
      'gme-coverage-75',
    );
    expect(skillSlug(forgeQuest({ id: 'tdd', kind: 'tdd', target: undefined }))).toBe('gme-tdd');
    expect(skillSlug(forgeQuest({ id: 'ci', kind: 'ci', target: undefined }))).toBe('gme-ci');
  });

  it('is deterministic — the same quest always names the same scroll', () => {
    const quest = forgeQuest();
    expect(skillSlug(quest)).toBe(skillSlug(forgeQuest()));
  });

  it('never strays outside gme-* (kebab, lowercase, no stray runes)', () => {
    const quest = forgeQuest({ target: 'src/Wyrm Lair/$tre@sure.tsx', id: 'slay:weird' });
    expect(skillSlug(quest)).toMatch(/^gme-[a-z0-9-]+$/);
  });
});

// ── The fallback template ────────────────────────────────────────────────────

describe('fallbackGuidance — the squire counsels even when the seer is mute', () => {
  it('names the real commands, framework, and dragon numbers for a slay quest', () => {
    const dragons = [forgeDragon({ file: 'src/moat-auth.ts' })];
    const guidance = fallbackGuidance(forgeQuest(), forgeScan(), forgeConfig(), dragons);
    const steps = guidance.steps.join('\n');
    expect(guidance.steps.length).toBeGreaterThanOrEqual(3);
    expect(guidance.steps.length).toBeLessThanOrEqual(6);
    expect(steps).toContain('npx vitest run --coverage');
    expect(steps).toContain('vitest');
    expect(steps).toContain('src/moat-auth.ts');
    expect(steps).toContain('42 uncovered lines');
    expect(guidance.flavor).toContain('Vexmaw');
  });

  it('suggests the repo-convention tests/ dir when no test names the target', () => {
    const guidance = fallbackGuidance(
      forgeQuest(),
      forgeScan({ testFiles: ['tests/drawbridge.test.ts'] }),
      forgeConfig(),
      [forgeDragon({ file: 'src/moat-auth.ts' })],
    );
    expect(guidance.steps.join('\n')).toContain('tests/moat-auth.test.ts');
  });

  it('points an existing ward at the dragon when one already names it', () => {
    const guidance = fallbackGuidance(
      forgeQuest(),
      forgeScan({ testFiles: ['tests/moat-auth.test.ts'] }),
      forgeConfig(),
      [forgeDragon({ file: 'src/moat-auth.ts' })],
    );
    expect(guidance.steps.join('\n')).toContain('Extend tests/moat-auth.test.ts');
  });

  it('ranks the biggest living dragons for coverage quests', () => {
    const quest = forgeQuest({ id: 'coverage:75', kind: 'coverage', target: undefined });
    const dragons = [
      forgeDragon({ file: 'src/moat-auth.ts', hp: 12 }),
      forgeDragon({ file: 'src/drawbridge.ts', hp: 97 }),
      forgeDragon({ file: 'src/slain.ts', hp: 0, slain: true }),
    ];
    const steps = fallbackGuidance(quest, forgeScan(), forgeConfig(), dragons).steps.join('\n');
    expect(steps).toContain('src/drawbridge.ts (97 uncovered lines)');
    expect(steps).not.toContain('src/slain.ts');
  });

  it('tells the ci quest to forge a workflow running the real test command', () => {
    const quest = forgeQuest({ id: 'ci', kind: 'ci', target: undefined });
    const steps = fallbackGuidance(quest, forgeScan(), forgeConfig(), []).steps.join('\n');
    expect(steps).toContain('.github/workflows/test.yml');
    expect(steps).toContain('npx vitest run');
  });

  it('uses the configured e2e command when one exists', () => {
    const quest = forgeQuest({ id: 'e2e', kind: 'e2e', target: undefined });
    const cfg = forgeConfig({ e2eCommand: 'npm run test:e2e' });
    const steps = fallbackGuidance(quest, forgeScan(), cfg, []).steps.join('\n');
    expect(steps).toContain('npm run test:e2e');
  });
});

// ── Forging the scroll ───────────────────────────────────────────────────────

describe('forgeSkill — the scroll itself', () => {
  const dragons = [forgeDragon({ file: 'src/moat-auth.ts' })];

  it('writes SKILL.md at .claude/skills/gme-<slug>/ and reports fallback', async () => {
    const result = await forgeSkill(forgeQuest(), forgeScan(), forgeConfig(), dragons);
    expect(result.path).toBe(join(keep, '.claude', 'skills', 'gme-slay-moat-auth', 'SKILL.md'));
    expect(result.source).toBe('fallback');
    expect(existsSync(result.path)).toBe(true);
  });

  it('forges frontmatter with name, a triggering description, and a paths glob', async () => {
    const { path } = await forgeSkill(forgeQuest(), forgeScan(), forgeConfig(), dragons);
    const scroll = readFileSync(path, 'utf8');
    expect(scroll.startsWith('---\n')).toBe(true);
    expect(scroll).toContain('name: gme-slay-moat-auth');
    expect(scroll).toContain('Slay Vexmaw the Untested');
    expect(scroll).toContain('paths:');
    expect(scroll).toContain('  - "src/moat-auth.ts"');
    const description = /^description: (.*)$/m.exec(scroll)?.[1] ?? '';
    expect(description).toContain('src/moat-auth.ts');
    expect(description.length).toBeLessThanOrEqual(400);
  });

  it('brands the body with the ownership marker naming the quest id', async () => {
    const { path } = await forgeSkill(forgeQuest(), forgeScan(), forgeConfig(), dragons);
    const scroll = readFileSync(path, 'utf8');
    expect(scroll).toContain(
      `${FORGE_MARKER_PREFIX} v1 quest:slay:src/moat-auth.ts — managed by Dragonslayer; renounce the pledge to remove -->`,
    );
    expect(hasForgeMarker(scroll)).toBe(true);
  });

  it('carries the objective checklist, real scan facts, and verbatim commands', async () => {
    const { path } = await forgeSkill(forgeQuest(), forgeScan(), forgeConfig(), dragons);
    const scroll = readFileSync(path, 'utf8');
    expect(scroll).toContain('## Objective');
    expect(scroll).toContain('- [ ] Bring src/moat-auth.ts to 100% line coverage.');
    expect(scroll).toContain('## Current state');
    expect(scroll).toContain('31% line coverage, 42 uncovered lines');
    expect(scroll).toContain('55% total line coverage');
    expect(scroll).toContain('## How to complete it');
    expect(scroll).toContain('## Verify');
    expect(scroll).toContain('```bash\nnpx vitest run\nnpx vitest run --coverage\n```');
    expect(scroll).toContain('the next forge (`f` in the game)');
  });

  it('is deterministic — forging twice yields identical bytes', async () => {
    const { path } = await forgeSkill(forgeQuest(), forgeScan(), forgeConfig(), dragons);
    const first = readFileSync(path, 'utf8');
    await forgeSkill(forgeQuest(), forgeScan(), forgeConfig(), dragons);
    expect(readFileSync(path, 'utf8')).toBe(first);
  });

  it('keeps the body lean (under ~80 lines after the frontmatter)', async () => {
    const { path } = await forgeSkill(forgeQuest(), forgeScan(), forgeConfig(), dragons);
    const scroll = readFileSync(path, 'utf8');
    const body = scroll.split('---\n').slice(2).join('---\n');
    expect(body.split('\n').length).toBeLessThanOrEqual(80);
  });

  it('omits the paths glob for untargeted quests but bakes in trigger keywords', async () => {
    const ci = forgeQuest({ id: 'ci', kind: 'ci', target: undefined, title: 'Raise the Watch' });
    const { path } = await forgeSkill(ci, forgeScan(), forgeConfig(), []);
    const scroll = readFileSync(path, 'utf8');
    expect(scroll).not.toContain('paths:');
    expect(scroll).toContain('CI workflow');

    const e2e = forgeQuest({ id: 'e2e', kind: 'e2e', target: undefined, title: 'The Gauntlet' });
    const e2eScroll = readFileSync((await forgeSkill(e2e, forgeScan(), forgeConfig(), [])).path, 'utf8');
    expect(e2eScroll).toContain('playwright');
  });

  it('takes the seer words when the CLI answers cleanly', async () => {
    stubClaude((cb) => cb(null, envelope(GUIDANCE_JSON), ''));
    const result = await forgeSkill(forgeQuest(), forgeScan(), forgeConfig(), dragons);
    expect(result.source).toBe('claude');
    const scroll = readFileSync(result.path, 'utf8');
    expect(scroll).toContain('The seer hums over the anvil.');
    expect(scroll).toContain('1. Read the lair map.');
    expect(scroll).toContain('3. Run the rite.');
  });

  it('falls back when the seer speaks gibberish, keeping the marker and commands', async () => {
    stubClaude((cb) => cb(null, envelope('the entrails refuse to settle'), ''));
    const result = await forgeSkill(forgeQuest(), forgeScan(), forgeConfig(), dragons);
    expect(result.source).toBe('fallback');
    const scroll = readFileSync(result.path, 'utf8');
    expect(hasForgeMarker(scroll)).toBe(true);
    expect(scroll).toContain('npx vitest run --coverage');
  });
});

// ── Marker honor ─────────────────────────────────────────────────────────────

describe('the marker oath — never overwrite another smith\'s scroll', () => {
  it('refuses to overwrite an unmarked SKILL.md and leaves it untouched', async () => {
    const quest = forgeQuest();
    const path = skillPath(quest, forgeConfig());
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, '# A hand-written skill\nPrecious and unbranded.\n', 'utf8');

    await expect(forgeSkill(quest, forgeScan(), forgeConfig(), [])).rejects.toThrow(
      /forge-marker/,
    );
    expect(readFileSync(path, 'utf8')).toBe('# A hand-written skill\nPrecious and unbranded.\n');
  });

  it('re-forges over its own marked scroll without complaint', async () => {
    const quest = forgeQuest();
    const first = await forgeSkill(quest, forgeScan(), forgeConfig(), []);
    const result = await forgeSkill(quest, forgeScan(), forgeConfig(), [
      forgeDragon({ file: 'src/moat-auth.ts', hp: 7, coveragePct: 80 }),
    ]);
    expect(result.path).toBe(first.path);
    expect(readFileSync(result.path, 'utf8')).toContain('7 uncovered lines');
  });
});

// ── Renouncing the pledge ────────────────────────────────────────────────────

describe('renounceSkill — the pledge withdrawn', () => {
  it('removes the generated skill directory when the scroll bears the marker', async () => {
    const quest = forgeQuest();
    const { path } = await forgeSkill(quest, forgeScan(), forgeConfig(), []);
    renounceSkill(quest, forgeConfig());
    expect(existsSync(path)).toBe(false);
    expect(existsSync(dirname(path))).toBe(false);
  });

  it('spares an unmarked SKILL.md squatting in the slug directory', () => {
    const quest = forgeQuest();
    const path = skillPath(quest, forgeConfig());
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, '# Not ours\n', 'utf8');
    renounceSkill(quest, forgeConfig());
    expect(readFileSync(path, 'utf8')).toBe('# Not ours\n');
  });

  it('does nothing at all when no scroll exists', () => {
    expect(() => renounceSkill(forgeQuest(), forgeConfig())).not.toThrow();
  });
});

// ── Reading the entrails ─────────────────────────────────────────────────────

describe('extractGuidanceJson — divining guidance from the utterance', () => {
  it('reads bare JSON', () => {
    const guidance = extractGuidanceJson(GUIDANCE_JSON);
    expect(guidance?.flavor).toBe('The seer hums over the anvil.');
    expect(guidance?.steps).toHaveLength(3);
  });

  it('reads JSON wrapped in a fenced code block with prose around it', () => {
    const utterance = `Behold!\n\n\`\`\`json\n${GUIDANCE_JSON}\n\`\`\`\n\nSo it is written.`;
    expect(extractGuidanceJson(utterance)?.steps).toHaveLength(3);
  });

  it('rejects guidance with too few or too many steps', () => {
    expect(extractGuidanceJson('{"flavor":"x","steps":["one","two"]}')).toBeNull();
    expect(
      extractGuidanceJson('{"flavor":"x","steps":["1","2","3","4","5","6","7"]}'),
    ).toBeNull();
  });

  it('rejects empty flavor, non-string steps, and non-objects', () => {
    expect(extractGuidanceJson('{"flavor":"  ","steps":["a","b","c"]}')).toBeNull();
    expect(extractGuidanceJson('{"flavor":"x","steps":["a",2,"c"]}')).toBeNull();
    expect(extractGuidanceJson('[1,2,3]')).toBeNull();
    expect(extractGuidanceJson('')).toBeNull();
  });
});

// ── Rendering directly ───────────────────────────────────────────────────────

describe('renderSkill — pure rendering, no clocks, no dice', () => {
  it('stamps the scan timestamp, not the wall clock', () => {
    const scroll = renderSkill(forgeQuest(), forgeScan(), forgeConfig(), [], {
      flavor: 'A sentence.',
      steps: ['One.', 'Two.', 'Three.'],
    });
    expect(scroll).toContain(new Date(1717000000000).toISOString());
  });

  it('marks completed objectives with [x]', () => {
    const quest = forgeQuest({
      objectives: [{ id: 'o', description: 'Done deed.', done: true }],
    });
    const scroll = renderSkill(quest, forgeScan(), forgeConfig(), [], {
      flavor: 'A sentence.',
      steps: ['One.', 'Two.', 'Three.'],
    });
    expect(scroll).toContain('- [x] Done deed.');
  });
});
