/**
 * Trials of the Daily Augury.
 *
 * The real `claude` CLI is never summoned here: `node:child_process` is
 * mocked, so the claude-path tests feed canned utterances and the fallback
 * tests feed only misfortune. The fenced-block inscriptions are exercised
 * against a temp-dir lair that is razed after every test.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Augury, RepoScan } from '../types.js';
import {
  EDICT_END_MARKER,
  EDICT_START_MARKER,
  canConsult,
  clearEdict,
  consultAugury,
  edictFocus,
  fallbackAugury,
  inscribeEdict,
  judgeAugury,
  renderEdictBlock,
  type AugurySnapshot,
} from './augury.js';

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

// ── Fixture forging ──────────────────────────────────────────────────────────

function snap(coveragePct: number, testFiles: number, dragonsSlain: number): AugurySnapshot {
  return { coveragePct, testFiles, dragonsSlain };
}

function forgeAugury(overrides: Partial<Augury> = {}): Augury {
  return {
    date: '2026-06-08',
    kind: 'omen',
    edict: 'Each new module ships with a test file naming its core behaviors.',
    proclamation: 'The smoke refuses to settle.',
    snapshot: snap(40, 3, 1),
    source: 'fallback',
    ...overrides,
  };
}

function forgeScan(overrides: Partial<RepoScan> = {}): RepoScan {
  return {
    repoPath: '/kingdom/keep',
    coverage: null,
    playwright: { configured: false, specCount: 0 },
    ci: { workflows: [], hasTestJob: false },
    sourceFiles: ['src/moat.ts', 'src/drawbridge.ts'],
    testFiles: ['tests/moat.test.ts'],
    scannedAt: 0,
    ...overrides,
  };
}

const TODAY = '2026-06-09';

beforeEach(() => {
  execFileMock.mockReset();
});

// ── The judgment matrix ──────────────────────────────────────────────────────

describe('judgeAugury — the cave weighs the realm', () => {
  it('grants a neutral omen on the first visit, with no honor to judge', () => {
    const verdict = judgeAugury(undefined, snap(0, 0, 0), TODAY);
    expect(verdict.kind).toBe('omen');
    expect(verdict.honored).toBeUndefined();
  });

  it.each([
    ['coverage rose', snap(40, 3, 1), snap(45, 3, 1)],
    ['a test file was forged', snap(40, 3, 1), snap(40, 4, 1)],
    ['a dragon fell', snap(40, 3, 1), snap(40, 3, 2)],
    ['every front advanced', snap(40, 3, 1), snap(60, 5, 3)],
  ])('blesses when %s and nothing decayed', (_label, before, now) => {
    const prev = forgeAugury({ snapshot: before });
    expect(judgeAugury(prev, now, TODAY).kind).toBe('blessing');
  });

  it.each([
    ['coverage fell', snap(40, 3, 1), snap(35, 3, 1)],
    ['a test file was lost', snap(40, 3, 1), snap(40, 2, 1)],
    ['gains elsewhere cannot excuse a loss', snap(40, 3, 1), snap(70, 2, 5)],
  ])('curses when %s', (_label, before, now) => {
    const prev = forgeAugury({ snapshot: before });
    expect(judgeAugury(prev, now, TODAY).kind).toBe('curse');
  });

  it('returns another omen when nothing moved at all', () => {
    const prev = forgeAugury({ snapshot: snap(40, 3, 1) });
    expect(judgeAugury(prev, snap(40, 3, 1), TODAY).kind).toBe('omen');
  });

  it('is deterministic across tellings', () => {
    const prev = forgeAugury({ snapshot: snap(40, 3, 1) });
    expect(judgeAugury(prev, snap(45, 3, 1), TODAY)).toEqual(
      judgeAugury(prev, snap(45, 3, 1), TODAY),
    );
  });
});

describe("judgeAugury — honoring yesterday's edict", () => {
  it('honors a curse whose focus metric improved, even amid fresh decay', () => {
    // testFiles === 0 at issuance → the curse's edict aimed at test files.
    const prev = forgeAugury({ kind: 'curse', snapshot: snap(40, 0, 0) });
    const verdict = judgeAugury(prev, snap(30, 2, 0), TODAY);
    expect(verdict.kind).toBe('curse'); // coverage fell — a fresh curse
    expect(verdict.honored).toBe(true); // but the old edict was honored
  });

  it("marks a blessing's edict unhonored when its focus metric stalled", () => {
    // coveragePct >= 80 at issuance → the blessing's edict aimed at coverage.
    const prev = forgeAugury({ kind: 'blessing', snapshot: snap(90, 4, 2) });
    const verdict = judgeAugury(prev, snap(90, 5, 2), TODAY);
    expect(verdict.honored).toBe(false);
  });

  it("honors an omen aimed at the slay-count once a dragon falls", () => {
    // tests exist, coverage ≥ 50, no kills → focus is dragonsSlain.
    const prev = forgeAugury({ kind: 'omen', snapshot: snap(60, 3, 0) });
    const verdict = judgeAugury(prev, snap(60, 3, 1), TODAY);
    expect(verdict.kind).toBe('blessing');
    expect(verdict.honored).toBe(true);
  });

  it('always renders an honored verdict (true or false) when a prior augury stood', () => {
    const prev = forgeAugury({ snapshot: snap(40, 3, 1) });
    expect(judgeAugury(prev, snap(40, 3, 1), TODAY).honored).toBeTypeOf('boolean');
  });
});

describe('edictFocus — where the edict aims', () => {
  it('curses aim at the weakest front', () => {
    expect(edictFocus('curse', snap(90, 0, 5))).toBe('testFiles');
    expect(edictFocus('curse', snap(20, 3, 5))).toBe('coveragePct');
    expect(edictFocus('curse', snap(80, 3, 0))).toBe('dragonsSlain');
    expect(edictFocus('curse', snap(80, 3, 2))).toBe('coveragePct');
  });

  it('blessings praise the strongest front', () => {
    expect(edictFocus('blessing', snap(85, 1, 0))).toBe('coveragePct');
    expect(edictFocus('blessing', snap(40, 1, 3))).toBe('dragonsSlain');
    expect(edictFocus('blessing', snap(40, 2, 0))).toBe('testFiles');
    expect(edictFocus('blessing', snap(10, 0, 0))).toBe('coveragePct');
  });
});

// ── Date gating ──────────────────────────────────────────────────────────────

describe('canConsult — one augury per dawn', () => {
  it('admits a knight who has never consulted', () => {
    expect(canConsult(undefined, TODAY)).toBe(true);
  });

  it('turns away a same-day revisit', () => {
    expect(canConsult(forgeAugury({ date: TODAY }), TODAY)).toBe(false);
  });

  it("admits the knight once yesterday's augury has aged", () => {
    expect(canConsult(forgeAugury({ date: '2026-06-08' }), TODAY)).toBe(true);
  });
});

// ── The deterministic fallback ───────────────────────────────────────────────

describe('fallbackAugury — when the seer will not speak', () => {
  it('is deterministic for the same day and judgment', () => {
    const a = fallbackAugury({ kind: 'curse', honored: false }, snap(30, 0, 0), TODAY);
    const b = fallbackAugury({ kind: 'curse', honored: false }, snap(30, 0, 0), TODAY);
    expect(a).toEqual(b);
  });

  it('stamps date, kind, snapshot, and fallback source onto the augury', () => {
    const augury = fallbackAugury({ kind: 'blessing', honored: true }, snap(85, 4, 2), TODAY);
    expect(augury.date).toBe(TODAY);
    expect(augury.kind).toBe('blessing');
    expect(augury.snapshot).toEqual(snap(85, 4, 2));
    expect(augury.source).toBe('fallback');
    expect(augury.honored).toBe(true);
    expect(augury.proclamation.length).toBeGreaterThan(20);
  });

  it('omits honored entirely on a first-visit omen', () => {
    const augury = fallbackAugury({ kind: 'omen' }, snap(0, 0, 0), TODAY);
    expect('honored' in augury).toBe(false);
  });

  it('issues edicts that read as professional style directives, free of dragons', () => {
    for (const kind of ['blessing', 'curse', 'omen'] as const) {
      for (const date of ['2026-06-09', '2026-06-10', '2026-06-11']) {
        const augury = fallbackAugury({ kind }, snap(40, 0, 0), date);
        expect(augury.edict).toMatch(/test/i);
        expect(augury.edict).not.toMatch(/dragon|oracle|knight|realm|ward/i);
      }
    }
  });

  it('mandates test-first discipline when cursed with zero test files', () => {
    const augury = fallbackAugury({ kind: 'curse', honored: false }, snap(40, 0, 1), TODAY);
    expect(augury.edict).toMatch(/test/i);
    expect(augury.kind).toBe('curse');
  });
});

// ── Consulting through the mocked seer ───────────────────────────────────────

describe('consultAugury — the seer, scripted', () => {
  it('uses the claude words when the CLI answers cleanly', async () => {
    stubClaude((cb) =>
      cb(
        null,
        JSON.stringify({
          result: JSON.stringify({
            proclamation: 'The cave speaks of rising wards.',
            edict: 'Prefer table-driven tests named for the behavior they guard.',
          }),
        }),
        '',
      ),
    );
    const prev = forgeAugury({ snapshot: snap(40, 3, 1) });
    const augury = await consultAugury(prev, snap(50, 4, 2), TODAY, forgeScan());
    expect(augury.source).toBe('claude');
    expect(augury.kind).toBe('blessing'); // judgment stays deterministic
    expect(augury.edict).toBe('Prefer table-driven tests named for the behavior they guard.');
    expect(augury.proclamation).toBe('The cave speaks of rising wards.');
    expect(augury.honored).toBeTypeOf('boolean');
    expect(execFileMock).toHaveBeenCalledTimes(1);
    const [bin, args] = execFileMock.mock.calls[0] as unknown as [string, string[]];
    expect(bin).toBe('claude');
    expect(args[0]).toBe('-p');
    expect(args.slice(2)).toEqual(['--output-format', 'json']);
  });

  it('tolerates a fenced JSON answer', async () => {
    stubClaude((cb) =>
      cb(
        null,
        JSON.stringify({
          result: '```json\n{"proclamation":"Smoke parts.","edict":"Inject clocks and randomness so tests stay deterministic."}\n```',
        }),
        '',
      ),
    );
    const augury = await consultAugury(undefined, snap(0, 0, 0), TODAY, forgeScan());
    expect(augury.source).toBe('claude');
    expect(augury.edict).toBe('Inject clocks and randomness so tests stay deterministic.');
  });

  it('falls back silently when the binary is absent', async () => {
    stubClaude((cb) => cb(new Error('ENOENT: claude not found'), '', ''));
    const augury = await consultAugury(undefined, snap(10, 1, 0), TODAY, forgeScan());
    expect(augury.source).toBe('fallback');
    expect(augury.kind).toBe('omen');
    expect(augury.date).toBe(TODAY);
  });

  it('falls back when the seer speaks unparseable riddles', async () => {
    stubClaude((cb) => cb(null, JSON.stringify({ result: 'the moon is full tonight' }), ''));
    const prev = forgeAugury({ snapshot: snap(50, 3, 1) });
    const augury = await consultAugury(prev, snap(45, 3, 1), TODAY, forgeScan());
    expect(augury.source).toBe('fallback');
    expect(augury.kind).toBe('curse');
  });

  it('falls back when the envelope is missing its result', async () => {
    stubClaude((cb) => cb(null, JSON.stringify({ is_error: true }), ''));
    const augury = await consultAugury(undefined, snap(0, 0, 0), TODAY, forgeScan());
    expect(augury.source).toBe('fallback');
  });

  it('rejects words where the edict is blank, and falls back', async () => {
    stubClaude((cb) =>
      cb(null, JSON.stringify({ result: '{"proclamation":"Doom!","edict":"  "}' }), ''),
    );
    const augury = await consultAugury(undefined, snap(0, 0, 0), TODAY, forgeScan());
    expect(augury.source).toBe('fallback');
  });
});

// ── Inscribing edicts into the harness scrolls ───────────────────────────────

describe('inscribeEdict / clearEdict — the fenced block', () => {
  let lair: string;

  beforeEach(() => {
    lair = mkdtempSync(join(tmpdir(), 'gme-augury-'));
  });

  afterEach(() => {
    rmSync(lair, { recursive: true, force: true });
  });

  const occurrences = (haystack: string, needle: string): number =>
    haystack.split(needle).length - 1;

  it('creates CLAUDE.md and AGENTS.md holding just the block when absent', () => {
    const augury = forgeAugury({ date: TODAY, edict: 'Write the failing test first.' });
    const written = inscribeEdict(lair, augury);
    expect(written).toEqual([join(lair, 'CLAUDE.md'), join(lair, 'AGENTS.md')]);
    for (const path of written) {
      const content = readFileSync(path, 'utf8');
      expect(content.startsWith(EDICT_START_MARKER)).toBe(true);
      expect(content.trimEnd().endsWith(EDICT_END_MARKER)).toBe(true);
      expect(content).toContain('Write the failing test first.');
      expect(content).toContain(TODAY);
    }
  });

  it('replaces only the block on a second inscription', () => {
    inscribeEdict(lair, forgeAugury({ edict: 'Old law: mock nothing.' }));
    inscribeEdict(lair, forgeAugury({ edict: 'New law: name tests for behaviors.' }));
    const content = readFileSync(join(lair, 'CLAUDE.md'), 'utf8');
    expect(content).toContain('New law: name tests for behaviors.');
    expect(content).not.toContain('Old law: mock nothing.');
    expect(occurrences(content, EDICT_START_MARKER)).toBe(1);
    expect(occurrences(content, EDICT_END_MARKER)).toBe(1);
  });

  it('appends the block to an existing scroll and never touches the prose around it', () => {
    const prose = '# House rules\n\nAlways bow to the king.\n';
    writeFileSync(join(lair, 'CLAUDE.md'), prose, 'utf8');
    inscribeEdict(lair, forgeAugury({ edict: 'First law.' }));
    let content = readFileSync(join(lair, 'CLAUDE.md'), 'utf8');
    expect(content.startsWith(prose)).toBe(true);
    expect(content).toContain('First law.');

    inscribeEdict(lair, forgeAugury({ edict: 'Second law.' }));
    content = readFileSync(join(lair, 'CLAUDE.md'), 'utf8');
    expect(content.startsWith(prose)).toBe(true);
    expect(content).toContain('Second law.');
    expect(content).not.toContain('First law.');
    expect(occurrences(content, EDICT_START_MARKER)).toBe(1);
  });

  it('replaces a block buried mid-scroll, preserving text on both sides', () => {
    const before = '# Top matter\n\n';
    const after = '\n\n# Bottom matter\nstays put\n';
    const old = renderEdictBlock(forgeAugury({ edict: 'Stale edict.' }));
    writeFileSync(join(lair, 'AGENTS.md'), before + old + after, 'utf8');

    inscribeEdict(lair, forgeAugury({ edict: 'Fresh edict.' }));
    const content = readFileSync(join(lair, 'AGENTS.md'), 'utf8');
    expect(content.startsWith(before)).toBe(true);
    expect(content.endsWith(after)).toBe(true);
    expect(content).toContain('Fresh edict.');
    expect(content).not.toContain('Stale edict.');
  });

  it('clearEdict deletes a scroll that was nothing but the block', () => {
    inscribeEdict(lair, forgeAugury());
    clearEdict(lair);
    expect(existsSync(join(lair, 'CLAUDE.md'))).toBe(false);
    expect(existsSync(join(lair, 'AGENTS.md'))).toBe(false);
  });

  it('clearEdict excises the block but keeps a scroll with other prose', () => {
    const prose = '# Keep me\n\nimportant words\n';
    writeFileSync(join(lair, 'CLAUDE.md'), prose, 'utf8');
    inscribeEdict(lair, forgeAugury({ edict: 'Temporary law.' }));
    clearEdict(lair);

    expect(existsSync(join(lair, 'CLAUDE.md'))).toBe(true);
    const content = readFileSync(join(lair, 'CLAUDE.md'), 'utf8');
    expect(content).toContain('important words');
    expect(content).not.toContain('Temporary law.');
    expect(content).not.toContain(EDICT_START_MARKER);
    expect(content).not.toContain(EDICT_END_MARKER);
    expect(content.startsWith(prose)).toBe(true);
  });

  it('clearEdict leaves a marker-less scroll untouched and ignores missing files', () => {
    const prose = '# No markers here\n';
    writeFileSync(join(lair, 'CLAUDE.md'), prose, 'utf8');
    // AGENTS.md does not exist at all.
    expect(() => clearEdict(lair)).not.toThrow();
    expect(readFileSync(join(lair, 'CLAUDE.md'), 'utf8')).toBe(prose);
    expect(existsSync(join(lair, 'AGENTS.md'))).toBe(false);
  });

  it('a full day cycle: inscribe, re-judge tomorrow, re-inscribe, then clear', () => {
    const dayOne = forgeAugury({ date: '2026-06-08', kind: 'curse', edict: 'Day-one law.' });
    inscribeEdict(lair, dayOne);
    expect(canConsult(dayOne, '2026-06-08')).toBe(false);
    expect(canConsult(dayOne, TODAY)).toBe(true);

    const dayTwo = fallbackAugury(judgeAugury(dayOne, snap(55, 4, 2), TODAY), snap(55, 4, 2), TODAY);
    expect(dayTwo.kind).toBe('blessing');
    inscribeEdict(lair, dayTwo);
    const content = readFileSync(join(lair, 'AGENTS.md'), 'utf8');
    expect(content).toContain(dayTwo.edict);
    expect(content).not.toContain('Day-one law.');

    clearEdict(lair);
    expect(existsSync(join(lair, 'CLAUDE.md'))).toBe(false);
    expect(existsSync(join(lair, 'AGENTS.md'))).toBe(false);
  });
});
