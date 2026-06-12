/**
 * rust.ts — the Interpreter of the Crab Tongue.
 *
 * Rust realms forge their proof with cargo-llvm-cov, which exports llvm-cov's
 * JSON ledger (`llvm.coverage.json.export`). This interpreter reads that
 * dialect into CoverageData: lines, functions and branches map straight
 * across, and llvm "regions" — the closest thing the dialect has to
 * statements — fill the statements column.
 *
 * When cargo-llvm-cov is NOT installed, the forge command fails visibly
 * (cargo prints "no such command: llvm-cov") and the realm falls back to
 * coverage-less dragons at full HP; plain `cargo test` still works, so trials
 * remain available. The armory inspector lists the missing binary with its
 * install URL so the player knows exactly which blade to fetch.
 */

import type { CoverageData, CoverageFileStats, CoverageMetric } from '../../types.js';
import type { LanguageAdapter, ParseContext } from './adapter.js';
import { asFiniteNumber, emptyMetric, makeMetric } from './metrics.js';
import { toRepoRelativePosix } from './paths.js';

/** Weigh one llvm summary entry ({count, covered, ...}) on the Assayer's Scales. */
function metricFromSummary(raw: unknown): CoverageMetric {
  if (raw === null || typeof raw !== 'object') return emptyMetric();
  const entry = raw as Record<string, unknown>;
  return makeMetric(asFiniteNumber(entry.count), asFiniteNumber(entry.covered));
}

/** Sum per-file metrics into a realm total; an empty realm scores 0 (mergeCoverageData's law). */
function sumMetrics(metrics: CoverageMetric[]): CoverageMetric {
  const total = metrics.reduce((acc, m) => acc + m.total, 0);
  const covered = metrics.reduce((acc, m) => acc + m.covered, 0);
  const pct = total > 0 ? Number(((covered / total) * 100).toFixed(2)) : 0;
  return { total, covered, pct };
}

export const rustAdapter: LanguageAdapter = {
  language: 'rust',
  coverageFormat: 'llvm-cov-json',
  defaults: {
    testCommand: 'cargo test',
    coverageCommand: 'cargo llvm-cov --json --output-path coverage.json',
    coverageSummaryGlobs: ['coverage.json'],
    sourceGlobs: ['src/**/*.rs'],
    excludeGlobs: ['**/target/**', 'tests/**', 'benches/**', 'examples/**'],
    // Known limitation: inline `#[cfg(test)] mod trials { ... }` modules live
    // INSIDE source files and cannot be globbed as test files. This only
    // affects the tdd-quest test count, never coverage — llvm-cov still
    // measures every line those trials prove.
    testGlobs: ['tests/**/*.rs'],
  },
  requiredTools: [
    {
      binary: 'cargo',
      installUrl: 'https://rustup.rs',
      neededFor: 'tests',
    },
    {
      binary: 'cargo',
      installUrl: 'https://rustup.rs',
      neededFor: 'coverage',
    },
    {
      binary: 'cargo-llvm-cov',
      installUrl: 'https://github.com/taiki-e/cargo-llvm-cov#installation',
      neededFor: 'coverage',
    },
  ],
  parseCoverage(raw: string, ctx: ParseContext): CoverageData | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // A forged or water-damaged proof — better none than lies.
      return null;
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const doc = parsed as Record<string, unknown>;
    // An export without a data array is not llvm's testimony at all.
    if (!Array.isArray(doc.data) || doc.data.length === 0) return null;
    const datum = doc.data[0];
    if (datum === null || typeof datum !== 'object') return null;
    const fileEntries = (datum as Record<string, unknown>).files;
    if (!Array.isArray(fileEntries)) return null;

    const files: CoverageFileStats[] = [];
    for (const entry of fileEntries) {
      if (entry === null || typeof entry !== 'object') continue;
      const record = entry as Record<string, unknown>;
      if (typeof record.filename !== 'string') continue;
      const summary = (record.summary ?? {}) as Record<string, unknown>;
      files.push({
        // llvm speaks in absolute paths; file everything repo-relative posix.
        path: toRepoRelativePosix(record.filename, ctx.repoPath),
        lines: metricFromSummary(summary.lines),
        // llvm has no "statements"; regions are the closest analogue.
        statements: metricFromSummary(summary.regions),
        functions: metricFromSummary(summary.functions),
        branches:
          summary.branches === undefined
            ? emptyMetric()
            : metricFromSummary(summary.branches),
      });
    }
    files.sort((a, b) => a.path.localeCompare(b.path));

    // Recompute totals from the files we actually produced rather than
    // trusting data[0].totals — the sums must agree with what the game sees.
    return {
      files,
      totals: {
        lines: sumMetrics(files.map((f) => f.lines)),
        statements: sumMetrics(files.map((f) => f.statements)),
        functions: sumMetrics(files.map((f) => f.functions)),
        branches: sumMetrics(files.map((f) => f.branches)),
      },
      source: ctx.source,
      generatedAt: ctx.generatedAt,
    };
  },
};
