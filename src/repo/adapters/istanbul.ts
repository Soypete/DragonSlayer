/**
 * istanbul.ts — the Interpreter of the Old Tongue.
 *
 * The realm's founding dialect: istanbul `coverage-summary.json`, as emitted
 * by vitest, jest, c8 and kin. This interpreter also serves as the guild's
 * fallback — a realm whose tongue has no sworn interpreter yet is addressed
 * in the old tongue, exactly as before the guild existed.
 */

import * as path from 'node:path';
import type { CoverageData, CoverageFileStats } from '../../types.js';
import type { LanguageAdapter, ParseContext } from './adapter.js';
import { readMetric } from './metrics.js';
import { looksRooted, toRepoRelativePosix } from './paths.js';

/**
 * Normalize a raw istanbul json-summary document into CoverageData.
 * Pure: takes the parsed JSON, the repo root, and provenance as params.
 * `packageRoot` prefixes relative keys so a package's `src/foo.ts` lands at
 * `packages/api/src/foo.ts`; absolute keys are relativized against the repo
 * root and need no prefix.
 */
export function normalizeCoverageSummary(
  raw: Record<string, unknown>,
  repoPath: string,
  source: string,
  generatedAt: number,
  packageRoot = ''
): CoverageData {
  const files: CoverageFileStats[] = [];
  let totals: CoverageData['totals'] = {
    lines: readMetric(undefined),
    statements: readMetric(undefined),
    functions: readMetric(undefined),
    branches: readMetric(undefined),
  };

  for (const [key, value] of Object.entries(raw)) {
    const entry = (value ?? {}) as Record<string, unknown>;
    const stats = {
      lines: readMetric(entry.lines),
      statements: readMetric(entry.statements),
      functions: readMetric(entry.functions),
      branches: readMetric(entry.branches),
    };
    if (key === 'total') {
      totals = stats;
    } else {
      const rel = toRepoRelativePosix(key, repoPath);
      const placed =
        looksRooted(key.replace(/\\/g, '/')) || packageRoot === ''
          ? rel
          : path.posix.join(packageRoot, rel);
      files.push({ path: placed, ...stats });
    }
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, totals, source, generatedAt };
}

export const istanbulAdapter: LanguageAdapter = {
  language: 'js',
  coverageFormat: 'istanbul-summary',
  defaults: {
    testCommand: 'npx vitest run',
    coverageCommand: 'npx vitest run --coverage',
    coverageSummaryGlobs: [
      'coverage/coverage-summary.json',
      '**/coverage/coverage-summary.json',
    ],
    sourceGlobs: [
      'src/**/*.{ts,tsx,js,jsx}',
      'app/**/*.{ts,tsx,js,jsx}',
      'lib/**/*.{ts,tsx,js,jsx}',
      // Workspace lands: dragons may lair in any package of a monorepo.
      '{packages,apps,libs}/*/src/**/*.{ts,tsx,js,jsx}',
    ],
    excludeGlobs: [
      '**/*.test.*',
      '**/*.spec.*',
      '**/node_modules/**',
      '**/dist/**',
      '**/*.d.ts',
    ],
    testGlobs: [
      '**/*.test.*',
      '**/*.spec.*',
      '**/__tests__/**/*.{ts,tsx,js,jsx}',
      'test/**/*.{ts,tsx,js,jsx}',
      'tests/**/*.{ts,tsx,js,jsx}',
    ],
  },
  requiredTools: [
    {
      binary: 'npx',
      installUrl: 'https://nodejs.org/en/download',
      neededFor: 'tests',
    },
    {
      binary: 'npx',
      installUrl: 'https://nodejs.org/en/download',
      neededFor: 'coverage',
    },
  ],
  parseCoverage(raw: string, ctx: ParseContext): CoverageData | null {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }
      return normalizeCoverageSummary(
        parsed as Record<string, unknown>,
        ctx.repoPath,
        ctx.source,
        ctx.generatedAt,
        ctx.packageRoot ?? ''
      );
    } catch {
      // A forged or water-damaged proof — better none than lies.
      return null;
    }
  },
};
