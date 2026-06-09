import { beforeAll, describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import type { DragonSpecies, RepoScan } from '../types.js';
import { defaultConfig } from './config.js';
import {
  buildDragons,
  normalizeCoverageSummary,
  scanRepo,
  toRepoRelativePosix,
} from './scanner.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CASTLE = path.join(here, '__fixtures__', 'castle-greyhollow');

/** Forge one istanbul-style metric block. */
const metric = (total: number, covered: number) => ({
  total,
  covered,
  skipped: 0,
  pct: total === 0 ? 100 : Number(((covered / total) * 100).toFixed(2)),
});

const entry = (lines: ReturnType<typeof metric>) => ({
  lines,
  statements: lines,
  functions: metric(2, 1),
  branches: metric(4, 2),
});

beforeAll(() => {
  // The freshest proof-of-coverage, keyed by ABSOLUTE paths as istanbul writes them.
  const freshSummary = {
    total: entry(metric(12, 9)),
    [path.join(CASTLE, 'src', 'drawbridge.ts')]: entry(metric(4, 4)),
    [path.join(CASTLE, 'src', 'moat.ts')]: entry(metric(8, 5)),
  };
  mkdirSync(path.join(CASTLE, 'coverage'), { recursive: true });
  writeFileSync(
    path.join(CASTLE, 'coverage', 'coverage-summary.json'),
    JSON.stringify(freshSummary, null, 2)
  );

  // A stale decoy proof from a forgotten sub-armory; must lose on mtime.
  const decoyDir = path.join(CASTLE, 'packages', 'armory', 'coverage');
  const decoyPath = path.join(decoyDir, 'coverage-summary.json');
  mkdirSync(decoyDir, { recursive: true });
  writeFileSync(
    decoyPath,
    JSON.stringify({ total: entry(metric(100, 1)) }, null, 2)
  );
  const longAgo = new Date('2020-01-01T00:00:00Z');
  utimesSync(decoyPath, longAgo, longAgo);
});

async function surveyCastle(): Promise<RepoScan> {
  return scanRepo(defaultConfig(CASTLE));
}

describe('toRepoRelativePosix', () => {
  it('strips an absolute posix root down to relative posix', () => {
    expect(toRepoRelativePosix('/realm/keep/src/gate.ts', '/realm/keep')).toBe(
      'src/gate.ts'
    );
  });

  it('translates windows separators and drive letters', () => {
    expect(
      toRepoRelativePosix('C:\\realm\\keep\\src\\gate.ts', 'C:\\realm\\keep')
    ).toBe('src/gate.ts');
  });

  it('leaves already-relative keys alone (minus a leading ./)', () => {
    expect(toRepoRelativePosix('./src/gate.ts', '/realm/keep')).toBe('src/gate.ts');
    expect(toRepoRelativePosix('src/gate.ts', '/realm/keep')).toBe('src/gate.ts');
  });
});

describe('normalizeCoverageSummary (pure)', () => {
  it('splits totals from files and normalizes keys', () => {
    const data = normalizeCoverageSummary(
      {
        total: entry(metric(10, 5)),
        '/realm/keep/src/gate.ts': entry(metric(10, 5)),
      },
      '/realm/keep',
      'coverage/coverage-summary.json',
      1234
    );
    expect(data.totals.lines).toEqual({ total: 10, covered: 5, pct: 50 });
    expect(data.files).toHaveLength(1);
    expect(data.files[0]!.path).toBe('src/gate.ts');
    expect(data.source).toBe('coverage/coverage-summary.json');
    expect(data.generatedAt).toBe(1234);
  });

  it('treats istanbul\'s "Unknown" pct as 0 instead of NaN', () => {
    const data = normalizeCoverageSummary(
      {
        total: {
          lines: { total: 0, covered: 0, skipped: 0, pct: 'Unknown' },
        },
      },
      '/realm/keep',
      'x',
      0
    );
    expect(data.totals.lines.pct).toBe(0);
    expect(data.totals.branches).toEqual({ total: 0, covered: 0, pct: 0 });
  });
});

describe('scanRepo surveys castle-greyhollow', () => {
  it('normalizes absolute istanbul keys to repo-relative posix paths', async () => {
    const scan = await surveyCastle();
    expect(scan.coverage).not.toBeNull();
    expect(scan.coverage!.files.map((f) => f.path)).toEqual([
      'src/drawbridge.ts',
      'src/moat.ts',
    ]);
  });

  it('picks the freshest proof and ignores the stale decoy', async () => {
    const scan = await surveyCastle();
    expect(scan.coverage!.source).toBe('coverage/coverage-summary.json');
    expect(scan.coverage!.totals.lines).toEqual({ total: 12, covered: 9, pct: 75 });
    expect(scan.coverage!.generatedAt).toBeGreaterThan(
      new Date('2024-01-01').getTime()
    );
  });

  it('maps source files (excluding tests) and test files separately', async () => {
    const scan = await surveyCastle();
    expect(scan.sourceFiles).toEqual([
      'src/drawbridge.ts',
      'src/moat.ts',
      'src/portcullis.ts',
    ]);
    expect(scan.testFiles).toContain('tests/drawbridge.test.ts');
    expect(scan.testFiles).toContain('e2e/siege.spec.ts');
  });

  it('spots the siege engines (playwright) and counts battle plans', async () => {
    const scan = await surveyCastle();
    expect(scan.playwright.configured).toBe(true);
    expect(scan.playwright.configPath).toBe('playwright.config.ts');
    expect(scan.playwright.specCount).toBe(1);
  });

  it('inspects the castle watch (CI) and finds a test job', async () => {
    const scan = await surveyCastle();
    expect(scan.ci.workflows).toEqual(['.github/workflows/siege.yml']);
    expect(scan.ci.hasTestJob).toBe(true);
  });
});

describe('buildDragons takes the census', () => {
  const namer = (file: string) => ({
    name: `Vexmaw of ${path.posix.basename(file)}`,
    species: 'Null Drake' as DragonSpecies,
  });

  it('raises no dragon over fully-covered files, sized dragons elsewhere', async () => {
    const scan = await surveyCastle();
    const dragons = buildDragons(scan, namer);
    const byFile = new Map(dragons.map((d) => [d.file, d]));

    // drawbridge.ts sits at 100% — only a trophy remains.
    expect(byFile.has('src/drawbridge.ts')).toBe(false);

    // moat.ts: 8 lines, 5 covered → a 3 hp dragon at 62.5%.
    const moat = byFile.get('src/moat.ts');
    expect(moat).toBeDefined();
    expect(moat!.hp).toBe(3);
    expect(moat!.maxHp).toBe(3);
    expect(moat!.coveragePct).toBe(62.5);
    expect(moat!.weakened).toBe(0);
    expect(moat!.slain).toBe(false);
    expect(moat!.id).toBe('src/moat.ts');
    expect(moat!.name).toBe('Vexmaw of moat.ts');
  });

  it('gives uncharted files (no coverage entry) hp equal to their line count', async () => {
    const scan = await surveyCastle();
    const dragons = buildDragons(scan, namer);
    const portcullis = dragons.find((d) => d.file === 'src/portcullis.ts');

    const raw = readFileSync(path.join(CASTLE, 'src', 'portcullis.ts'), 'utf8');
    const lineCount = raw.replace(/\n$/, '').split('\n').length;

    expect(portcullis).toBeDefined();
    expect(portcullis!.hp).toBe(lineCount);
    expect(portcullis!.maxHp).toBe(lineCount);
    expect(portcullis!.coveragePct).toBe(0);
  });

  it('is deterministic for a fixed scan', async () => {
    const scan = await surveyCastle();
    expect(buildDragons(scan, namer)).toEqual(buildDragons(scan, namer));
  });
});
