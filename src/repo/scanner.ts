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
  Dragon,
  DragonSpecies,
  GameConfig,
  PlaywrightInfo,
  RepoScan,
} from '../types.js';
import { adapterForFormat, adapterForLanguage } from './adapters/adapter.js';
import { normalizeCoverageSummary } from './adapters/istanbul.js';
import { parseGoModulePath, toRepoRelativePosix } from './adapters/paths.js';
import { auditArmory, requiredToolsFor } from './toolchain.js';

// The old tongue's helpers moved to the Guild of Interpreters (adapters/);
// re-exported here so long-standing callers keep their maps unredrawn.
export { normalizeCoverageSummary, toRepoRelativePosix };

/** Lands no honest dragon would lair in (and no cartographer maps). */
const FORBIDDEN_LANDS = ['**/node_modules/**', '**/dist/**', '**/.git/**'];

/** How a dragon is christened — supplied by the caller so repo/ never imports game/. */
export type DragonNamer = (file: string) => { name: string; species: DragonSpecies };

// ── Coverage normalization (pure) ────────────────────────────────────────────

/**
 * The package a summary testifies for: the grandparent of the summary file
 * (`packages/api/coverage/coverage-summary.json` → `packages/api`), or `''`
 * when the summary sits in an output dir directly under the repo root.
 */
export function summaryPackageRoot(summaryRel: string): string {
  const outputDir = path.posix.dirname(summaryRel.replace(/\\/g, '/'));
  const pkg = path.posix.dirname(outputDir);
  return pkg === '.' || pkg === '/' ? '' : pkg;
}

/**
 * Merge coverage proofs from every armory into one realm-wide ledger.
 * On duplicate file paths the freshest proof wins; totals are recomputed
 * from the deduped files so nothing is counted twice.
 */
export function mergeCoverageData(parts: CoverageData[]): CoverageData | null {
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0]!;

  const ordered = [...parts].sort((a, b) => a.generatedAt - b.generatedAt);
  const ledger = new Map<string, CoverageFileStats>();
  for (const part of ordered) {
    for (const file of part.files) ledger.set(file.path, file);
  }

  const files = [...ledger.values()].sort((a, b) => a.path.localeCompare(b.path));
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

  return {
    files,
    totals,
    source: ordered
      .map((p) => p.source)
      .sort()
      .join(' + '),
    generatedAt: Math.max(...ordered.map((p) => p.generatedAt)),
  };
}

/** Does a summary's package root pass the steward's allow/deny globs? */
export function packageAllowed(
  pkgRoot: string,
  allowed: Set<string> | null,
  denied: Set<string>
): boolean {
  if (denied.has(pkgRoot)) return false;
  if (allowed === null) return true;
  return allowed.has(pkgRoot);
}

// ── Survey expeditions (IO) ──────────────────────────────────────────────────

/** Expand package globs into the set of package roots they bless (or ban). */
async function resolvePackageSet(
  globs: string[] | undefined,
  repoPath: string
): Promise<Set<string> | null> {
  if (!globs || globs.length === 0) return null;
  const set = new Set<string>();
  // "." names the repo root itself, which no directory glob would match.
  if (globs.includes('.')) set.add('');
  const dirs = await fg(globs, {
    cwd: repoPath,
    ignore: FORBIDDEN_LANDS,
    onlyDirectories: true,
    unique: true,
  });
  for (const dir of dirs) set.add(dir.replace(/\/+$/, ''));
  return set;
}

async function unearthCoverage(cfg: GameConfig): Promise<CoverageData | null> {
  // No interpreter for the dialect yet — no proof can be read.
  const interpreter = adapterForFormat(cfg.coverageFormat);
  if (!interpreter) return null;

  const candidates = await fg(cfg.coverageSummaryGlobs, {
    cwd: cfg.repoPath,
    ignore: FORBIDDEN_LANDS,
    dot: true,
    unique: true,
  });
  if (candidates.length === 0) return null;

  const [allowed, denied] = await Promise.all([
    resolvePackageSet(cfg.packages, cfg.repoPath),
    resolvePackageSet(cfg.excludePackages, cfg.repoPath),
  ]);

  // Go coverprofiles file paths under the module's import path; hand the
  // interpreter the module directive so it can strip the prefix.
  const goModulePath =
    cfg.coverageFormat === 'go-coverprofile'
      ? (parseGoModulePath(
          await readFile(path.join(cfg.repoPath, 'go.mod'), 'utf8').catch(() => '')
        ) ?? undefined)
      : undefined;

  // Every proof from every armory joins the realm — not just the freshest.
  const parts = await Promise.all(
    candidates
      .filter((rel) =>
        packageAllowed(summaryPackageRoot(rel), allowed, denied ?? new Set())
      )
      .map(async (rel): Promise<CoverageData | null> => {
        try {
          const abs = path.join(cfg.repoPath, rel);
          const s = await stat(abs);
          const raw = await readFile(abs, 'utf8');
          return interpreter.parseCoverage(raw, {
            repoPath: cfg.repoPath,
            source: rel,
            generatedAt: s.mtimeMs,
            packageRoot: summaryPackageRoot(rel),
            goModulePath,
          });
        } catch {
          // Forged, water-damaged, or vanished proof — better none than lies.
          return null;
        }
      })
  );

  return mergeCoverageData(parts.filter((p): p is CoverageData => p !== null));
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
      // `go test` and `cargo test` already match \btest\b; pytest does not
      // (no word boundary inside "pytest"), so it gets its own banner.
      if (/\b(test|vitest|jest|playwright|pytest)\b/i.test(scroll)) {
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
  const interpreter = adapterForLanguage(cfg.language);
  const [sourceFiles, testFiles, coverage, playwright, ci, missingTools] =
    await Promise.all([
      fg(cfg.sourceGlobs, {
        cwd: cfg.repoPath,
        ignore: [...cfg.excludeGlobs, ...FORBIDDEN_LANDS],
        unique: true,
      }),
      fg(cfg.testGlobs, { cwd: cfg.repoPath, ignore: FORBIDDEN_LANDS, unique: true }),
      unearthCoverage(cfg),
      scryPlaywright(cfg.repoPath),
      inspectCastleWatch(cfg.repoPath),
      auditArmory(requiredToolsFor(cfg, interpreter.requiredTools)),
    ]);

  return {
    repoPath: cfg.repoPath,
    coverage,
    playwright,
    ci,
    sourceFiles: sourceFiles.sort(),
    testFiles: testFiles.sort(),
    scannedAt: Date.now(),
    language: cfg.language,
    missingTools,
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
