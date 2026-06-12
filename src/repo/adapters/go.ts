/**
 * go.ts — the Interpreter of the Gopher Tongue.
 *
 * Reads Go coverprofiles (`go test -coverprofile=coverage.out`): a `mode:`
 * line followed by one block per line in the shape
 * `<file>:<startLine>.<startCol>,<endLine>.<endCol> <numStmts> <count>`.
 * A line of ground is proven when ANY block covering it has count > 0; a
 * statement is proven when its block's count is > 0. Functions and branches
 * are measures this dialect cannot speak of.
 */

import type { CoverageData, CoverageFileStats } from '../../types.js';
import type { LanguageAdapter, ParseContext } from './adapter.js';
import { emptyMetric, makeMetric } from './metrics.js';
import { toRepoRelativePosix } from './paths.js';

/** The opening oath of every honest coverprofile. */
const MODE_LINE = /^mode:\s*(set|count|atomic)\s*$/;

/** `<file>:<startLine>.<startCol>,<endLine>.<endCol> <numStmts> <count>` */
const BLOCK_LINE = /^(.+):(\d+)\.(\d+),(\d+)\.(\d+)\s+(\d+)\s+(\d+)\s*$/;

/** Per-file running tally while the profile is read. */
interface Tally {
  /** Highest count seen for each line — max wins where blocks overlap. */
  lineHits: Map<number, number>;
  stmtTotal: number;
  stmtCovered: number;
}

export const goAdapter: LanguageAdapter = {
  language: 'go',
  coverageFormat: 'go-coverprofile',
  defaults: {
    testCommand: 'go test ./...',
    coverageCommand: 'go test ./... -coverprofile=coverage.out -covermode=atomic',
    coverageSummaryGlobs: ['coverage.out'],
    sourceGlobs: ['**/*.go'],
    excludeGlobs: ['**/*_test.go', '**/vendor/**', '**/testdata/**'],
    testGlobs: ['**/*_test.go'],
  },
  requiredTools: [
    {
      binary: 'go',
      installUrl: 'https://go.dev/doc/install',
      neededFor: 'tests',
    },
    {
      binary: 'go',
      installUrl: 'https://go.dev/doc/install',
      neededFor: 'coverage',
    },
  ],
  parseCoverage(raw: string, ctx: ParseContext): CoverageData | null {
    const rows = raw.split(/\r?\n/);

    // The profile must open with its mode oath; without one it's a forgery.
    let at = 0;
    while (at < rows.length && rows[at]!.trim() === '') at += 1;
    if (at >= rows.length || !MODE_LINE.test(rows[at]!.trim())) return null;

    const ledger = new Map<string, Tally>();
    for (at += 1; at < rows.length; at += 1) {
      const row = rows[at]!.trim();
      if (row === '') continue;
      const block = BLOCK_LINE.exec(row);
      if (!block) continue; // A garbled block proves nothing; skip, never crash.

      const key = block[1]!;
      const startLine = Number(block[2]);
      const endLine = Number(block[4]);
      const numStmts = Number(block[6]);
      const count = Number(block[7]);
      if (endLine < startLine) continue; // A block running backwards is garbled too.

      let tally = ledger.get(key);
      if (!tally) {
        tally = { lineHits: new Map(), stmtTotal: 0, stmtCovered: 0 };
        ledger.set(key, tally);
      }
      tally.stmtTotal += numStmts;
      if (count > 0) tally.stmtCovered += numStmts;
      for (let line = startLine; line <= endLine; line += 1) {
        tally.lineHits.set(line, Math.max(tally.lineHits.get(line) ?? 0, count));
      }
    }

    // Coverprofiles file everything under the module's import path; strip it
    // so the ledger speaks repo-relative posix like every other dialect.
    const modulePrefix = ctx.goModulePath
      ? `${ctx.goModulePath.replace(/\/+$/, '')}/`
      : null;

    const files: CoverageFileStats[] = [];
    for (const [key, tally] of ledger) {
      const stripped =
        modulePrefix && key.startsWith(modulePrefix)
          ? key.slice(modulePrefix.length)
          : key;
      let coveredLines = 0;
      for (const hits of tally.lineHits.values()) {
        if (hits > 0) coveredLines += 1;
      }
      files.push({
        path: toRepoRelativePosix(stripped, ctx.repoPath),
        lines: makeMetric(tally.lineHits.size, coveredLines),
        statements: makeMetric(tally.stmtTotal, tally.stmtCovered),
        functions: emptyMetric(),
        branches: emptyMetric(),
      });
    }
    files.sort((a, b) => a.path.localeCompare(b.path));

    const totals = {} as CoverageData['totals'];
    for (const metric of ['lines', 'statements', 'functions', 'branches'] as const) {
      let total = 0;
      let covered = 0;
      for (const file of files) {
        total += file[metric].total;
        covered += file[metric].covered;
      }
      // An empty realm scores 0, never 100 — victory demands proven ground.
      const pct = total > 0 ? Number(((covered / total) * 100).toFixed(2)) : 0;
      totals[metric] = { total, covered, pct };
    }

    return { files, totals, source: ctx.source, generatedAt: ctx.generatedAt };
  },
};
