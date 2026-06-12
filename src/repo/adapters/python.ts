/**
 * python.ts — the Interpreter of the Serpent Tongue.
 *
 * Reads coverage.py's JSON report (coverage.py >= 5, as emitted by
 * `pytest --cov --cov-report=json`): a top-level `files` map keyed by
 * relative path, each entry carrying `executed_lines` / `missing_lines`
 * arrays and a `summary` block. Lines are counted from the line lists,
 * statements from the summary, branches only when the report speaks of
 * them; coverage.py never weighs functions, so that scale stays unweighed.
 */

import type { CoverageData, CoverageFileStats } from '../../types.js';
import type { LanguageAdapter, ParseContext } from './adapter.js';
import { asFiniteNumber, emptyMetric, makeMetric } from './metrics.js';
import { toRepoRelativePosix } from './paths.js';

/** How many lines a report names; a missing or malformed list names none. */
const lineCount = (value: unknown): number =>
  Array.isArray(value) ? value.length : 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Sum per-file counts into realm totals. An empty realm scores 0, never a
 * hollow 100 — the same law mergeCoverageData enforces.
 */
function sumTotals(files: CoverageFileStats[]): CoverageData['totals'] {
  const totals = {} as CoverageData['totals'];
  for (const metric of ['lines', 'statements', 'functions', 'branches'] as const) {
    let total = 0;
    let covered = 0;
    for (const file of files) {
      total += file[metric].total;
      covered += file[metric].covered;
    }
    const pct = total > 0 ? Number(((covered / total) * 100).toFixed(2)) : 0;
    totals[metric] = { total, covered, pct };
  }
  return totals;
}

export const pythonAdapter: LanguageAdapter = {
  language: 'python',
  coverageFormat: 'coverage-py-json',
  defaults: {
    testCommand: 'pytest',
    coverageCommand: 'pytest --cov --cov-report=json',
    coverageSummaryGlobs: ['coverage.json'],
    sourceGlobs: ['**/*.py'],
    excludeGlobs: [
      '**/test_*.py',
      '**/*_test.py',
      'tests/**',
      '**/.venv/**',
      '**/venv/**',
      '**/__pycache__/**',
      '**/.tox/**',
    ],
    testGlobs: ['**/test_*.py', '**/*_test.py', 'tests/**/*.py'],
  },
  requiredTools: [
    {
      binary: 'pytest',
      installUrl: 'https://docs.pytest.org/en/stable/getting-started.html',
      neededFor: 'tests',
    },
    {
      binary: 'pytest',
      installUrl: 'https://docs.pytest.org/en/stable/getting-started.html',
      neededFor: 'coverage',
    },
  ],
  parseCoverage(raw: string, ctx: ParseContext): CoverageData | null {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }
      const filesRaw = (parsed as Record<string, unknown>).files;
      if (filesRaw === null || typeof filesRaw !== 'object' || Array.isArray(filesRaw)) {
        return null;
      }

      const files: CoverageFileStats[] = [];
      for (const [key, value] of Object.entries(filesRaw as Record<string, unknown>)) {
        const entry = (value ?? {}) as Record<string, unknown>;
        const summary = (entry.summary ?? {}) as Record<string, unknown>;

        const executed = lineCount(entry.executed_lines);
        const missing = lineCount(entry.missing_lines);
        // The serpent tongue counts branches only when asked (--cov-branch);
        // a report that stays silent on them leaves the scale unweighed.
        const branches =
          isFiniteNumber(summary.num_branches) &&
          isFiniteNumber(summary.covered_branches)
            ? makeMetric(summary.num_branches, summary.covered_branches)
            : emptyMetric();

        files.push({
          path: toRepoRelativePosix(key, ctx.repoPath),
          lines: makeMetric(executed + missing, executed),
          statements: makeMetric(
            asFiniteNumber(summary.num_statements),
            asFiniteNumber(summary.covered_lines)
          ),
          functions: emptyMetric(),
          branches,
        });
      }

      files.sort((a, b) => a.path.localeCompare(b.path));
      return {
        files,
        totals: sumTotals(files),
        source: ctx.source,
        generatedAt: ctx.generatedAt,
      };
    } catch {
      // A forged or water-damaged proof — better none than lies.
      return null;
    }
  },
};
