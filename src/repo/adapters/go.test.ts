import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defaultConfig, resolveConfig } from '../config.js';
import { scanRepo } from '../scanner.js';
import { goAdapter } from './go.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const barrow = path.join(here, '..', '__fixtures__', 'barrow-of-gophers');

const ctx = {
  repoPath: barrow,
  source: 'coverage.out',
  generatedAt: 1234,
  goModulePath: 'github.com/realm/barrow-of-gophers',
};

describe('the gopher interpreter reads a coverprofile', () => {
  const raw = readFileSync(path.join(barrow, 'coverage.out'), 'utf8');

  it('parses the barrow-of-gophers proof with the module prefix stripped', () => {
    const data = goAdapter.parseCoverage(raw, ctx);
    expect(data).not.toBeNull();
    expect(data?.files.map((f) => f.path)).toEqual(['hoard.go', 'lair.go']);
    expect(data?.source).toBe('coverage.out');
    expect(data?.generatedAt).toBe(1234);
  });

  it('weighs lair.go: Dig proven, Seal untrodden', () => {
    const lair = goAdapter.parseCoverage(raw, ctx)?.files.find(
      (f) => f.path === 'lair.go'
    );
    // Blocks span lines 11–14 (count 1) and 17–20 (count 0): 8 lines, 4 proven.
    expect(lair?.lines).toEqual({ total: 8, covered: 4, pct: 50 });
    expect(lair?.statements).toEqual({ total: 4, covered: 2, pct: 50 });
    // Measures this dialect cannot speak of stay unweighed.
    expect(lair?.functions).toEqual({ total: 0, covered: 0, pct: 0 });
    expect(lair?.branches).toEqual({ total: 0, covered: 0, pct: 0 });
  });

  it('weighs hoard.go: Stash proven, Plunder untrodden', () => {
    const hoard = goAdapter.parseCoverage(raw, ctx)?.files.find(
      (f) => f.path === 'hoard.go'
    );
    // Blocks span lines 9–12 (count 1) and 15–19 (count 0): 9 lines, 4 proven.
    expect(hoard?.lines).toEqual({ total: 9, covered: 4, pct: 44.44 });
    expect(hoard?.statements).toEqual({ total: 5, covered: 2, pct: 40 });
  });

  it('sums realm totals across both files', () => {
    const totals = goAdapter.parseCoverage(raw, ctx)?.totals;
    expect(totals?.lines).toEqual({ total: 17, covered: 8, pct: 47.06 });
    expect(totals?.statements).toEqual({ total: 9, covered: 4, pct: 44.44 });
    expect(totals?.functions).toEqual({ total: 0, covered: 0, pct: 0 });
    expect(totals?.branches).toEqual({ total: 0, covered: 0, pct: 0 });
  });

  it('keeps keys verbatim when no module path is known', () => {
    const data = goAdapter.parseCoverage(raw, { ...ctx, goModulePath: undefined });
    expect(data?.files.map((f) => f.path)).toEqual([
      'github.com/realm/barrow-of-gophers/hoard.go',
      'github.com/realm/barrow-of-gophers/lair.go',
    ]);
  });
});

describe('the gopher interpreter resolves overlapping blocks', () => {
  it('calls a line proven when ANY block over it has count > 0', () => {
    const raw = [
      'mode: count',
      'github.com/realm/barrow-of-gophers/lair.go:3.2,7.2 3 0',
      'github.com/realm/barrow-of-gophers/lair.go:5.2,6.10 1 4',
    ].join('\n');
    const lair = goAdapter.parseCoverage(raw, ctx)?.files[0];
    // Union of 3..7 is 5 lines; the count-4 block proves lines 5 and 6.
    expect(lair?.lines).toEqual({ total: 5, covered: 2, pct: 40 });
    expect(lair?.statements).toEqual({ total: 4, covered: 1, pct: 25 });
  });

  it('skips garbled block lines without crashing', () => {
    const raw = [
      'mode: atomic',
      'this line is pure dragon-scratch',
      'github.com/realm/barrow-of-gophers/lair.go:11.24,14.2 2 1',
      'github.com/realm/barrow-of-gophers/lair.go:9.1,4.2 9 9',
    ].join('\n');
    const data = goAdapter.parseCoverage(raw, ctx);
    expect(data?.files).toHaveLength(1);
    expect(data?.files[0]?.lines).toEqual({ total: 4, covered: 4, pct: 100 });
  });
});

describe('the gopher interpreter rejects forged proofs', () => {
  it('returns null on pure garbage', () => {
    expect(goAdapter.parseCoverage('not a coverprofile at all', ctx)).toBeNull();
    expect(goAdapter.parseCoverage('', ctx)).toBeNull();
  });

  it('returns null when the mode oath is missing', () => {
    const raw = 'github.com/realm/barrow-of-gophers/lair.go:11.24,14.2 2 1';
    expect(goAdapter.parseCoverage(raw, ctx)).toBeNull();
    expect(goAdapter.parseCoverage('mode: jousting\n' + raw, ctx)).toBeNull();
  });

  it('scores an empty realm 0, never 100', () => {
    const data = goAdapter.parseCoverage('mode: set\n', ctx);
    expect(data?.files).toEqual([]);
    expect(data?.totals.lines).toEqual({ total: 0, covered: 0, pct: 0 });
  });
});

describe('the realm of barrow-of-gophers, end to end', () => {
  it('resolveConfig hears the gopher tongue at the gate', async () => {
    const cfg = await resolveConfig(barrow);
    expect(cfg.language).toBe('go');
    expect(cfg.coverageFormat).toBe('go-coverprofile');
    expect(cfg.testCommand).toBe('go test ./...');
    expect(cfg.coverageCommand).toBe(
      'go test ./... -coverprofile=coverage.out -covermode=atomic'
    );
  });

  it('scanRepo unearths the committed coverage.out with repo-relative paths', async () => {
    const scan = await scanRepo(defaultConfig(barrow, 'go'));
    expect(scan.coverage).not.toBeNull();
    expect(scan.coverage?.files.map((f) => f.path)).toEqual([
      'hoard.go',
      'lair.go',
    ]);
    expect(scan.coverage?.totals.lines.pct).toBe(47.06);
    expect(scan.coverage?.source).toBe('coverage.out');
  });

  it('drafts *_test.go files as guards, never dragon hosts', async () => {
    const scan = await scanRepo(defaultConfig(barrow, 'go'));
    expect(scan.sourceFiles).toEqual(['hoard.go', 'lair.go']);
    expect(scan.testFiles).toEqual(['lair_test.go']);
  });
});
