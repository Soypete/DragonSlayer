import { beforeAll, describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import type { DragonSpecies, RepoScan } from '../types.js';
import { defaultConfig } from './config.js';
import {
  buildDragons,
  mergeCoverageData,
  normalizeCoverageSummary,
  packageAllowed,
  scanRepo,
  summaryPackageRoot,
  toRepoRelativePosix,
} from './scanner.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CASTLE = path.join(here, '__fixtures__', 'castle-greyhollow');
const VALE = path.join(here, '__fixtures__', 'turbo-vale');

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

  // An older proof from a sub-armory, keyed by RELATIVE paths; it must
  // merge into the realm with its paths prefixed by the package root.
  const armoryDir = path.join(CASTLE, 'packages', 'armory', 'coverage');
  const armoryPath = path.join(armoryDir, 'coverage-summary.json');
  mkdirSync(armoryDir, { recursive: true });
  writeFileSync(
    armoryPath,
    JSON.stringify(
      {
        total: entry(metric(100, 1)),
        'src/anvil.ts': entry(metric(100, 1)),
      },
      null,
      2
    )
  );
  const longAgo = new Date('2020-01-01T00:00:00Z');
  utimesSync(armoryPath, longAgo, longAgo);

  // The turbo vale: two workspaces, each filing its own proof.
  // Portal speaks in absolute paths, armory in relative — both dialects merge.
  const portalDir = path.join(VALE, 'packages', 'portal', 'coverage');
  mkdirSync(portalDir, { recursive: true });
  writeFileSync(
    path.join(portalDir, 'coverage-summary.json'),
    JSON.stringify(
      {
        total: entry(metric(10, 8)),
        [path.join(VALE, 'packages', 'portal', 'src', 'gate.ts')]: entry(
          metric(6, 6)
        ),
        [path.join(VALE, 'packages', 'portal', 'src', 'beacon.ts')]: entry(
          metric(4, 2)
        ),
      },
      null,
      2
    )
  );
  const anvilDir = path.join(VALE, 'packages', 'armory', 'coverage');
  mkdirSync(anvilDir, { recursive: true });
  writeFileSync(
    path.join(anvilDir, 'coverage-summary.json'),
    JSON.stringify(
      {
        total: entry(metric(5, 1)),
        'src/anvil.ts': entry(metric(5, 1)),
      },
      null,
      2
    )
  );
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

describe('summaryPackageRoot', () => {
  it.each([
    ['coverage/coverage-summary.json', ''],
    ['artifacts/coverage-summary.json', ''],
    ['packages/api/coverage/coverage-summary.json', 'packages/api'],
    ['apps/web/coverage/coverage-summary.json', 'apps/web'],
    ['libs/deep/nested/coverage/coverage-summary.json', 'libs/deep/nested'],
  ])('%s → %j', (rel, expected) => {
    expect(summaryPackageRoot(rel)).toBe(expected);
  });
});

describe('packageAllowed', () => {
  it('admits everyone when no allow-list stands', () => {
    expect(packageAllowed('packages/api', null, new Set())).toBe(true);
    expect(packageAllowed('', null, new Set())).toBe(true);
  });

  it('admits only the blessed when an allow-list stands', () => {
    const allowed = new Set(['packages/api']);
    expect(packageAllowed('packages/api', allowed, new Set())).toBe(true);
    expect(packageAllowed('packages/web', allowed, new Set())).toBe(false);
    expect(packageAllowed('', allowed, new Set())).toBe(false);
  });

  it('the deny-list overrules even the blessed', () => {
    const allowed = new Set(['packages/api']);
    const denied = new Set(['packages/api']);
    expect(packageAllowed('packages/api', allowed, denied)).toBe(false);
  });
});

describe('normalizeCoverageSummary with a package root', () => {
  it('prefixes relative keys with the package root', () => {
    const data = normalizeCoverageSummary(
      { 'src/anvil.ts': entry(metric(5, 1)) },
      '/realm/vale',
      'packages/armory/coverage/coverage-summary.json',
      7,
      'packages/armory'
    );
    expect(data.files[0]!.path).toBe('packages/armory/src/anvil.ts');
  });

  it('leaves absolute keys alone — they already know the whole realm', () => {
    const data = normalizeCoverageSummary(
      { '/realm/vale/packages/armory/src/anvil.ts': entry(metric(5, 1)) },
      '/realm/vale',
      'packages/armory/coverage/coverage-summary.json',
      7,
      'packages/armory'
    );
    expect(data.files[0]!.path).toBe('packages/armory/src/anvil.ts');
  });
});

describe('mergeCoverageData', () => {
  const part = (
    source: string,
    generatedAt: number,
    files: Record<string, [number, number]>
  ) =>
    normalizeCoverageSummary(
      Object.fromEntries(
        Object.entries(files).map(([p, [t, c]]) => [p, entry(metric(t, c))])
      ),
      '/realm',
      source,
      generatedAt
    );

  it('returns null for no proofs at all', () => {
    expect(mergeCoverageData([])).toBeNull();
  });

  it('returns a lone proof untouched, totals and all', () => {
    const lone = normalizeCoverageSummary(
      { total: entry(metric(10, 5)), 'src/a.ts': entry(metric(10, 5)) },
      '/realm',
      'coverage/coverage-summary.json',
      1
    );
    expect(mergeCoverageData([lone])).toBe(lone);
  });

  it('merges disjoint files and recomputes totals from the merged set', () => {
    const merged = mergeCoverageData([
      part('a', 1, { 'pkg/a/src/x.ts': [6, 6] }),
      part('b', 2, { 'pkg/b/src/y.ts': [4, 2] }),
    ])!;
    expect(merged.files.map((f) => f.path)).toEqual([
      'pkg/a/src/x.ts',
      'pkg/b/src/y.ts',
    ]);
    expect(merged.totals.lines).toEqual({ total: 10, covered: 8, pct: 80 });
    expect(merged.source).toBe('a + b');
    expect(merged.generatedAt).toBe(2);
  });

  it('lets the freshest proof win when two speak for the same file', () => {
    const merged = mergeCoverageData([
      part('newer', 9, { 'src/x.ts': [10, 9] }),
      part('older', 1, { 'src/x.ts': [10, 2] }),
    ])!;
    expect(merged.files).toHaveLength(1);
    expect(merged.totals.lines).toEqual({ total: 10, covered: 9, pct: 90 });
  });

  it('scores an empty merged realm 0, never a hollow 100', () => {
    const merged = mergeCoverageData([part('a', 1, {}), part('b', 2, {})])!;
    expect(merged.totals.lines).toEqual({ total: 0, covered: 0, pct: 0 });
  });
});

describe('scanRepo surveys the turbo vale (monorepo)', () => {
  it('merges every workspace proof into one realm with prefixed paths', async () => {
    const scan = await scanRepo(defaultConfig(VALE));
    expect(scan.coverage).not.toBeNull();
    expect(scan.coverage!.files.map((f) => f.path)).toEqual([
      'packages/armory/src/anvil.ts',
      'packages/portal/src/beacon.ts',
      'packages/portal/src/gate.ts',
    ]);
    // 6/6 + 4/2 + 5/1 summed across both packages.
    expect(scan.coverage!.totals.lines).toEqual({ total: 15, covered: 9, pct: 60 });
  });

  it('spawns dragons in every package (workspace sources are charted)', async () => {
    const scan = await scanRepo(defaultConfig(VALE));
    const namer = (file: string) => ({
      name: file,
      species: 'Null Drake' as DragonSpecies,
    });
    const dragons = buildDragons(scan, namer);
    const byFile = new Map(dragons.map((d) => [d.file, d]));

    // gate.ts is fully covered — only a trophy remains.
    expect(byFile.has('packages/portal/src/gate.ts')).toBe(false);

    const beacon = byFile.get('packages/portal/src/beacon.ts');
    expect(beacon).toBeDefined();
    expect(beacon!.hp).toBe(2);
    expect(beacon!.coveragePct).toBe(50);

    const anvil = byFile.get('packages/armory/src/anvil.ts');
    expect(anvil).toBeDefined();
    expect(anvil!.hp).toBe(4);
    expect(anvil!.coveragePct).toBe(20);
  });

  it('honors the packages allow-list', async () => {
    const scan = await scanRepo({
      ...defaultConfig(VALE),
      packages: ['packages/portal'],
    });
    expect(scan.coverage!.files.map((f) => f.path)).toEqual([
      'packages/portal/src/beacon.ts',
      'packages/portal/src/gate.ts',
    ]);
  });

  it('honors the excludePackages deny-list', async () => {
    const scan = await scanRepo({
      ...defaultConfig(VALE),
      excludePackages: ['packages/armory'],
    });
    expect(scan.coverage!.files.map((f) => f.path)).toEqual([
      'packages/portal/src/beacon.ts',
      'packages/portal/src/gate.ts',
    ]);
  });
});

describe('scanRepo surveys castle-greyhollow', () => {
  it('normalizes absolute istanbul keys to repo-relative posix paths', async () => {
    const scan = await surveyCastle();
    expect(scan.coverage).not.toBeNull();
    expect(scan.coverage!.files.map((f) => f.path)).toEqual([
      'packages/armory/src/anvil.ts',
      'src/drawbridge.ts',
      'src/moat.ts',
    ]);
  });

  it('merges proofs from every armory and recomputes the totals', async () => {
    const scan = await surveyCastle();
    expect(scan.coverage!.source).toBe(
      'coverage/coverage-summary.json + packages/armory/coverage/coverage-summary.json'
    );
    // 12/9 from the keep plus 100/1 from the armory, summed over files.
    expect(scan.coverage!.totals.lines).toEqual({
      total: 112,
      covered: 10,
      pct: 8.93,
    });
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
