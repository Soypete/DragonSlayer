import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfig } from '../config.js';
import { scanRepo } from '../scanner.js';
import { rustAdapter } from './rust.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const citadel = path.join(here, '..', '__fixtures__', 'crab-citadel');
const workspaceCrab = path.join(here, '..', '__fixtures__', 'workspace-crab');
const workspaceCrabExplicit = path.join(
  here,
  '..',
  '__fixtures__',
  'workspace-crab-explicit'
);

// The fixture's coverage.json speaks in synthetic absolute paths under
// /realm/crab-citadel, so the parser tests hand in that root as ctx.repoPath.
const ctx = {
  repoPath: '/realm/crab-citadel',
  source: 'coverage.json',
  generatedAt: 4242,
};

describe('the crab interpreter reads llvm-cov JSON exports', () => {
  const raw = readFileSync(path.join(citadel, 'coverage.json'), 'utf8');

  it('parses the citadel ledger into CoverageData', () => {
    const data = rustAdapter.parseCoverage(raw, ctx);
    expect(data).not.toBeNull();
    expect(data?.files).toHaveLength(1);
    expect(data?.files[0]?.path).toBe('src/lib.rs');
    expect(data?.source).toBe('coverage.json');
    expect(data?.generatedAt).toBe(4242);
  });

  it('maps llvm summaries onto the realm metrics, regions as statements', () => {
    const file = rustAdapter.parseCoverage(raw, ctx)?.files[0];
    expect(file?.lines).toEqual({ total: 12, covered: 9, pct: 75 });
    expect(file?.functions).toEqual({ total: 3, covered: 2, pct: 66.67 });
    expect(file?.branches).toEqual({ total: 4, covered: 2, pct: 50 });
    // llvm has no "statements"; regions are the closest analogue.
    expect(file?.statements).toEqual({ total: 8, covered: 5, pct: 62.5 });
  });

  it('recomputes totals from the per-file metrics it produced', () => {
    const twoTowers = JSON.stringify({
      type: 'llvm.coverage.json.export',
      version: '2.0.1',
      data: [
        {
          files: [
            {
              filename: '/realm/crab-citadel/src/lib.rs',
              summary: {
                lines: { count: 10, covered: 5, percent: 50 },
                functions: { count: 2, covered: 1, percent: 50 },
                regions: { count: 6, covered: 3, percent: 50 },
              },
            },
            {
              filename: '/realm/crab-citadel/src/winch.rs',
              summary: {
                lines: { count: 10, covered: 10, percent: 100 },
                functions: { count: 2, covered: 2, percent: 100 },
                branches: { count: 2, covered: 1, percent: 50 },
                regions: { count: 4, covered: 4, percent: 100 },
              },
            },
          ],
          // Deliberately lying totals: the parser must not trust them.
          totals: {
            lines: { count: 999, covered: 0, percent: 0 },
          },
        },
      ],
    });
    const data = rustAdapter.parseCoverage(twoTowers, ctx);
    expect(data?.files.map((f) => f.path)).toEqual(['src/lib.rs', 'src/winch.rs']);
    expect(data?.totals.lines).toEqual({ total: 20, covered: 15, pct: 75 });
    expect(data?.totals.functions).toEqual({ total: 4, covered: 3, pct: 75 });
    expect(data?.totals.statements).toEqual({ total: 10, covered: 7, pct: 70 });
    // lib.rs spoke no branches (emptyMetric); only winch.rs weighs in.
    expect(data?.totals.branches).toEqual({ total: 2, covered: 1, pct: 50 });
  });

  it('leaves an absent branches summary unweighed', () => {
    const noBranches = JSON.stringify({
      type: 'llvm.coverage.json.export',
      version: '2.0.1',
      data: [
        {
          files: [
            {
              filename: '/realm/crab-citadel/src/lib.rs',
              summary: {
                lines: { count: 4, covered: 4, percent: 100 },
                functions: { count: 1, covered: 1, percent: 100 },
                regions: { count: 2, covered: 2, percent: 100 },
              },
            },
          ],
        },
      ],
    });
    const file = rustAdapter.parseCoverage(noBranches, ctx)?.files[0];
    expect(file?.branches).toEqual({ total: 0, covered: 0, pct: 0 });
  });

  it('returns null for forged or water-damaged proofs', () => {
    expect(rustAdapter.parseCoverage('not json at all', ctx)).toBeNull();
    expect(rustAdapter.parseCoverage('null', ctx)).toBeNull();
    expect(rustAdapter.parseCoverage('[1,2,3]', ctx)).toBeNull();
    // A document with no data array is not llvm's testimony.
    expect(rustAdapter.parseCoverage('{"type":"something-else"}', ctx)).toBeNull();
    // An export whose data array is empty has nothing to testify.
    expect(
      rustAdapter.parseCoverage(
        '{"type":"llvm.coverage.json.export","version":"2.0.1","data":[]}',
        ctx
      )
    ).toBeNull();
  });
});

describe('the Quartermaster equips a rust realm', () => {
  // NOTE: we deliberately do NOT assert scanRepo coverage against this
  // fixture — its coverage.json speaks synthetic absolute paths under
  // /realm/crab-citadel, which will not relativize against the real fixture
  // directory on disk. The parser tests above cover that translation.
  it('detects the crab tongue and its standard-issue kit', async () => {
    const cfg = await resolveConfig(citadel);
    expect(cfg.language).toBe('rust');
    expect(cfg.coverageFormat).toBe('llvm-cov-json');
    expect(cfg.testCommand).toBe('cargo test');
    expect(cfg.coverageCommand).toBe(
      'cargo llvm-cov --json --output-path coverage.json'
    );
    expect(cfg.coverageSummaryGlobs).toEqual(['coverage.json']);
    expect(cfg.testGlobs).toEqual(['tests/**/*.rs']);
  });
});

describe('the Quartermaster equips a rust workspace realm', () => {
  it('derives source and test globs from Cargo workspace members', async () => {
    const cfg = await resolveConfig(workspaceCrab);
    expect(cfg.language).toBe('rust');
    expect(cfg.coverageCommand).toBe(
      'cargo llvm-cov --workspace --json --output-path coverage.json'
    );
    expect(cfg.sourceGlobs).toEqual([
      'crates/core/src/**/*.rs',
      'crates/cli/src/**/*.rs',
    ]);
    expect(cfg.testGlobs).toEqual([
      'crates/core/tests/**/*.rs',
      'crates/core/src/**/*_tests.rs',
      'crates/cli/tests/**/*.rs',
      'crates/cli/src/**/*_tests.rs',
    ]);
  });

  it('lets the cartographer survey workspace member sources and tests', async () => {
    const scan = await scanRepo(await resolveConfig(workspaceCrab));
    expect(scan.sourceFiles).toEqual([
      'crates/cli/src/main.rs',
      'crates/core/src/lib.rs',
    ]);
    expect(scan.testFiles).toEqual(['crates/core/tests/core.rs']);
  });

  it('lets explicit scroll globs override Cargo workspace globs', async () => {
    const cfg = await resolveConfig(workspaceCrabExplicit);
    expect(cfg.sourceGlobs).toEqual(['hand-picked/src/**/*.rs']);
    expect(cfg.testGlobs).toEqual(['hand-picked/tests/**/*.rs']);
  });
});
