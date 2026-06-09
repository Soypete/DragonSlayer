/**
 * Shared test fixtures for the game-core sagas. The `.test-helpers.ts` name
 * keeps vitest from running this as a suite while staying obviously test-only.
 */

import type {
  CoverageFileStats,
  CoverageMetric,
  Dragon,
  RepoScan,
} from '../types.js';
import { dragonName } from './naming.js';

export function metric(total: number, covered: number): CoverageMetric {
  return { total, covered, pct: total === 0 ? 100 : Math.round((covered / total) * 10000) / 100 };
}

export function fileStats(path: string, totalLines: number, coveredLines: number): CoverageFileStats {
  const m = metric(totalLines, coveredLines);
  return { path, lines: m, statements: m, functions: metric(1, 1), branches: metric(1, 1) };
}

export interface ScanOverrides {
  files?: CoverageFileStats[];
  totalPct?: number;
  sourceFiles?: string[];
  testFiles?: string[];
  playwrightConfigured?: boolean;
  specCount?: number;
  workflows?: string[];
  hasTestJob?: boolean;
  scannedAt?: number;
  noCoverage?: boolean;
}

export function makeScan(overrides: ScanOverrides = {}): RepoScan {
  const files = overrides.files ?? [];
  const totalPct = overrides.totalPct ?? 0;
  return {
    repoPath: '/realm/keep',
    coverage: overrides.noCoverage
      ? null
      : {
          files,
          totals: {
            lines: { total: 100, covered: totalPct, pct: totalPct },
            statements: { total: 100, covered: totalPct, pct: totalPct },
            functions: { total: 10, covered: 5, pct: 50 },
            branches: { total: 10, covered: 5, pct: 50 },
          },
          source: 'coverage/coverage-summary.json',
          generatedAt: 1_700_000_000_000,
        },
    playwright: {
      configured: overrides.playwrightConfigured ?? false,
      specCount: overrides.specCount ?? 0,
    },
    ci: {
      workflows: overrides.workflows ?? [],
      hasTestJob: overrides.hasTestJob ?? false,
    },
    sourceFiles: overrides.sourceFiles ?? files.map((f) => f.path),
    testFiles: overrides.testFiles ?? [],
    scannedAt: overrides.scannedAt ?? 1_700_000_111_000,
  };
}

export function makeDragon(file: string, overrides: Partial<Dragon> = {}): Dragon {
  const { name, species } = dragonName(file);
  const maxHp = overrides.maxHp ?? 20;
  return {
    id: file,
    file,
    name,
    species,
    maxHp,
    hp: overrides.hp ?? maxHp,
    weakened: 0,
    slain: false,
    coveragePct: 0,
    ...overrides,
  };
}
