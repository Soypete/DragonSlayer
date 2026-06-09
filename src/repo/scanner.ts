/**
 * scanner.ts — the Royal Cartographer.
 *
 * Surveys a repository's lands: which source files might harbor dragons,
 * which tests stand guard, where the most recent proof-of-coverage was
 * filed, whether siege engines (playwright) are stationed, and whether the
 * castle watch (CI) actually runs drills.
 */

import * as path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import fg from 'fast-glob';
import type {
  CiInfo,
  CoverageData,
  CoverageFileStats,
  CoverageMetric,
  Dragon,
  DragonSpecies,
  GameConfig,
  PlaywrightInfo,
  RepoScan,
} from '../types.js';

/** Lands no honest dragon would lair in (and no cartographer maps). */
const FORBIDDEN_LANDS = ['**/node_modules/**', '**/dist/**', '**/.git/**'];

/** Where the castle guard tends to drill. */
const TEST_GLOBS = [
  '**/*.test.*',
  '**/*.spec.*',
  '**/__tests__/**/*.{ts,tsx,js,jsx}',
  'test/**/*.{ts,tsx,js,jsx}',
  'tests/**/*.{ts,tsx,js,jsx}',
];

/** How a dragon is christened — supplied by the caller so repo/ never imports game/. */
export type DragonNamer = (file: string) => { name: string; species: DragonSpecies };

// ── Coverage normalization (pure) ────────────────────────────────────────────

function asFiniteNumber(value: unknown): number {
  // Istanbul writes "Unknown" for empty totals; treat anything unholy as 0.
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function readMetric(raw: unknown): CoverageMetric {
  const m = (raw ?? {}) as Record<string, unknown>;
  return {
    total: asFiniteNumber(m.total),
    covered: asFiniteNumber(m.covered),
    pct: asFiniteNumber(m.pct),
  };
}

const looksRooted = (p: string): boolean =>
  path.posix.isAbsolute(p) || /^[A-Za-z]:\//.test(p);

/** Translate any path the summary speaks (absolute, windows) into repo-relative posix. */
export function toRepoRelativePosix(key: string, repoPath: string): string {
  const slashed = key.replace(/\\/g, '/');
  const rootSlashed = repoPath.replace(/\\/g, '/');
  const root = looksRooted(rootSlashed)
    ? rootSlashed.replace(/\/+$/, '')
    : path.resolve(repoPath).replace(/\\/g, '/');
  const rel = looksRooted(slashed) ? path.posix.relative(root, slashed) : slashed;
  return rel.replace(/^\.\//, '');
}

/**
 * Normalize a raw istanbul json-summary document into CoverageData.
 * Pure: takes the parsed JSON, the repo root, and provenance as params.
 */
export function normalizeCoverageSummary(
  raw: Record<string, unknown>,
  repoPath: string,
  source: string,
  generatedAt: number
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
      files.push({ path: toRepoRelativePosix(key, repoPath), ...stats });
    }
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, totals, source, generatedAt };
}

// ── Survey expeditions (IO) ──────────────────────────────────────────────────

async function unearthCoverage(cfg: GameConfig): Promise<CoverageData | null> {
  const candidates = await fg(cfg.coverageSummaryGlobs, {
    cwd: cfg.repoPath,
    ignore: FORBIDDEN_LANDS,
    dot: true,
    unique: true,
  });
  if (candidates.length === 0) return null;

  // Several proofs may be filed; the freshest seal wins.
  let freshest: { rel: string; mtimeMs: number } | null = null;
  for (const rel of candidates) {
    try {
      const s = await stat(path.join(cfg.repoPath, rel));
      if (!freshest || s.mtimeMs > freshest.mtimeMs) {
        freshest = { rel, mtimeMs: s.mtimeMs };
      }
    } catch {
      // The proof crumbled between glob and stat; skip it.
    }
  }
  if (!freshest) return null;

  try {
    const raw = JSON.parse(
      await readFile(path.join(cfg.repoPath, freshest.rel), 'utf8')
    ) as Record<string, unknown>;
    return normalizeCoverageSummary(raw, cfg.repoPath, freshest.rel, freshest.mtimeMs);
  } catch {
    // Forged or water-damaged proof — better none than lies.
    return null;
  }
}

async function scryPlaywright(repoPath: string): Promise<PlaywrightInfo> {
  const configs = await fg('**/playwright.config.{js,cjs,mjs,ts,cts,mts}', {
    cwd: repoPath,
    ignore: FORBIDDEN_LANDS,
    unique: true,
  });
  if (configs.length === 0) {
    return { configured: false, specCount: 0 };
  }

  const configPath = [...configs].sort()[0];
  const configDir = path.posix.dirname(configPath);

  // Count battle plans under the engine's own yard plus the usual mustering grounds.
  const yards = new Set<string>(['e2e/**', 'tests/**']);
  yards.add(configDir === '.' ? '**' : `${configDir}/**`);
  const specs = await fg(
    [...yards].map((yard) => `${yard}/*.spec.*`),
    { cwd: repoPath, ignore: FORBIDDEN_LANDS, unique: true }
  );

  return { configured: true, configPath, specCount: specs.length };
}

async function inspectCastleWatch(repoPath: string): Promise<CiInfo> {
  const workflows = await fg('.github/workflows/*.{yml,yaml}', {
    cwd: repoPath,
    dot: true,
    unique: true,
  });

  let hasTestJob = false;
  for (const wf of workflows) {
    try {
      const scroll = await readFile(path.join(repoPath, wf), 'utf8');
      if (/\b(test|vitest|jest|playwright)\b/i.test(scroll)) {
        hasTestJob = true;
        break;
      }
    } catch {
      // An unreadable duty roster proves nothing.
    }
  }
  return { workflows: workflows.sort(), hasTestJob };
}

/**
 * Survey the whole realm: sources, tests, coverage proof, siege engines, watch.
 */
export async function scanRepo(cfg: GameConfig): Promise<RepoScan> {
  const [sourceFiles, testFiles, coverage, playwright, ci] = await Promise.all([
    fg(cfg.sourceGlobs, {
      cwd: cfg.repoPath,
      ignore: [...cfg.excludeGlobs, ...FORBIDDEN_LANDS],
      unique: true,
    }),
    fg(TEST_GLOBS, { cwd: cfg.repoPath, ignore: FORBIDDEN_LANDS, unique: true }),
    unearthCoverage(cfg),
    scryPlaywright(cfg.repoPath),
    inspectCastleWatch(cfg.repoPath),
  ]);

  return {
    repoPath: cfg.repoPath,
    coverage,
    playwright,
    ci,
    sourceFiles: sourceFiles.sort(),
    testFiles: testFiles.sort(),
    scannedAt: Date.now(),
  };
}

// ── Dragon census ────────────────────────────────────────────────────────────

function countScaleRows(absPath: string): number {
  try {
    const hide = readFileSync(absPath, 'utf8');
    if (hide.length === 0) return 1;
    return hide.replace(/\n$/, '').split('\n').length;
  } catch {
    // A dragon we cannot even read still gets one obligatory hit point.
    return 1;
  }
}

/**
 * Take the census: every source file short of 100% line coverage hosts a
 * dragon (hp = uncovered lines). Files with NO coverage entry at all host
 * the most dangerous kind — hp equal to their full line count, because
 * nothing about them has ever been proven.
 */
export function buildDragons(scan: RepoScan, namer: DragonNamer): Dragon[] {
  const ledger = new Map<string, CoverageFileStats>(
    (scan.coverage?.files ?? []).map((f) => [f.path, f])
  );

  const dragons: Dragon[] = [];
  for (const file of scan.sourceFiles) {
    const proof = ledger.get(file);
    let hp: number;
    let coveragePct: number;

    if (proof) {
      if (proof.lines.pct >= 100) continue; // Slain already; only a trophy remains.
      hp = Math.max(1, Math.round(proof.lines.total - proof.lines.covered));
      coveragePct = proof.lines.pct;
    } else {
      hp = Math.max(1, countScaleRows(path.join(scan.repoPath, file)));
      coveragePct = 0;
    }

    const { name, species } = namer(file);
    dragons.push({
      id: file,
      file,
      name,
      species,
      maxHp: hp,
      hp,
      weakened: 0,
      slain: false,
      coveragePct,
    });
  }
  return dragons;
}
