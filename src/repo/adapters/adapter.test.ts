import { describe, expect, it } from 'vitest';
import { adapterForFormat, adapterForLanguage } from './adapter.js';
import { istanbulAdapter } from './istanbul.js';
import { emptyMetric, makeMetric } from './metrics.js';

describe('the Guild of Interpreters', () => {
  it('serves the old tongue by format', () => {
    expect(adapterForFormat('istanbul-summary')).toBe(istanbulAdapter);
  });

  it('serves js by language', () => {
    expect(adapterForLanguage('js')).toBe(istanbulAdapter);
  });

  it('addresses tongues with no sworn interpreter in the old tongue', () => {
    // Until an interpreter enlists, an unknown tongue gets the founding kit —
    // exactly what every realm received before the guild existed.
    expect(adapterForLanguage('go').coverageFormat).toBeDefined();
  });
});

describe('the Assayer’s Scales (metrics)', () => {
  it('weighs honest counts', () => {
    expect(makeMetric(10, 7)).toEqual({ total: 10, covered: 7, pct: 70 });
    expect(makeMetric(3, 1).pct).toBeCloseTo(33.33, 2);
  });

  it('calls empty ground fully proven — no immortal dragons', () => {
    expect(makeMetric(0, 0).pct).toBe(100);
  });

  it('keeps the unweighed metric at zero', () => {
    expect(emptyMetric()).toEqual({ total: 0, covered: 0, pct: 0 });
  });
});

describe('the istanbul interpreter reads raw text', () => {
  const ctx = {
    repoPath: '/realm/keep',
    source: 'coverage/coverage-summary.json',
    generatedAt: 1234,
  };

  it('parses a summary document into CoverageData', () => {
    const raw = JSON.stringify({
      total: { lines: { total: 10, covered: 5, pct: 50 } },
      '/realm/keep/src/moat.ts': {
        lines: { total: 10, covered: 5, pct: 50 },
        statements: { total: 10, covered: 5, pct: 50 },
        functions: { total: 2, covered: 1, pct: 50 },
        branches: { total: 0, covered: 0, pct: 100 },
      },
    });
    const data = istanbulAdapter.parseCoverage(raw, ctx);
    expect(data).not.toBeNull();
    expect(data?.files).toHaveLength(1);
    expect(data?.files[0]?.path).toBe('src/moat.ts');
    expect(data?.totals.lines.covered).toBe(5);
    expect(data?.source).toBe(ctx.source);
    expect(data?.generatedAt).toBe(1234);
  });

  it('prefixes relative keys with the packageRoot of a monorepo summary', () => {
    const raw = JSON.stringify({
      'src/anvil.ts': { lines: { total: 4, covered: 4, pct: 100 } },
    });
    const data = istanbulAdapter.parseCoverage(raw, {
      ...ctx,
      packageRoot: 'packages/armory',
    });
    expect(data?.files[0]?.path).toBe('packages/armory/src/anvil.ts');
  });

  it('returns null for forged or water-damaged proofs', () => {
    expect(istanbulAdapter.parseCoverage('not json at all', ctx)).toBeNull();
    expect(istanbulAdapter.parseCoverage('[1,2,3]', ctx)).toBeNull();
    expect(istanbulAdapter.parseCoverage('null', ctx)).toBeNull();
  });
});
