/**
 * config.ts — the Quartermaster's Ledger.
 *
 * Before a knight rides into a repository, the quartermaster must know which
 * commands summon the trials (tests), which forge the proof of valor
 * (coverage), and where the siege engines (e2e) are kept. The ledger is
 * resolved in order of trust:
 *
 *   1. A `gme.config.json` scroll left at the repo gate by its stewards
 *      (its `coverageFormat` outranks its `language`, which outranks
 *      detection).
 *   2. The tongue the Realm Linguist reads off the gate's banners
 *      (go.mod, Cargo.toml, python manifests, package.json).
 *   3. For js realms only: divination from package.json scripts.
 *   4. The sworn interpreter's standard-issue kit for that tongue.
 */

import { readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { CoverageFormat, GameConfig, RepoLanguage } from '../types.js';
import { adapterForFormat, adapterForLanguage } from './adapters/adapter.js';
import { rustWorkspaceGlobs } from './cargo.js';
import { detectLanguage } from './detect.js';

const TONGUES: readonly RepoLanguage[] = ['js', 'go', 'python', 'rust'];
const DIALECTS: readonly CoverageFormat[] = [
  'istanbul-summary',
  'go-coverprofile',
  'coverage-py-json',
  'llvm-cov-json',
];

const isLanguage = (value: unknown): value is RepoLanguage =>
  typeof value === 'string' && (TONGUES as readonly string[]).includes(value);
const isFormat = (value: unknown): value is CoverageFormat =>
  typeof value === 'string' && (DIALECTS as readonly string[]).includes(value);

/** The scroll a repo's stewards may leave at the gate to override divination. */
export const CONFIG_SCROLL = 'gme.config.json';

/**
 * Standard-issue kit: what a squire carries when the gate bears no scroll —
 * the sworn interpreter's kit for the realm's tongue (js when unstated).
 */
export function defaultConfig(
  repoPath: string,
  language: RepoLanguage = 'js'
): GameConfig {
  const interpreter = adapterForLanguage(language);
  return {
    repoPath,
    language,
    coverageFormat: interpreter.coverageFormat,
    testCommand: interpreter.defaults.testCommand,
    coverageCommand: interpreter.defaults.coverageCommand,
    coverageSummaryGlobs: [...interpreter.defaults.coverageSummaryGlobs],
    sourceGlobs: [...interpreter.defaults.sourceGlobs],
    excludeGlobs: [...interpreter.defaults.excludeGlobs],
    testGlobs: [...interpreter.defaults.testGlobs],
  };
}

/** The command-shaped slice of the ledger that divination can fill in. */
export interface DivinedCommands {
  testCommand?: string;
  coverageCommand?: string;
  e2eCommand?: string;
}

/**
 * Read the entrails of a package.json `scripts` block and divine which
 * commands run the trials. Pure — feed it any scripts record.
 */
export function guessCommandsFromScripts(
  scripts: Record<string, unknown>
): DivinedCommands {
  const divined: DivinedCommands = {};
  const has = (name: string): boolean =>
    typeof scripts[name] === 'string' && (scripts[name] as string).trim() !== '';

  if (has('test:coverage')) {
    divined.coverageCommand = 'npm run test:coverage';
  } else if (has('coverage')) {
    divined.coverageCommand = 'npm run coverage';
  } else if (has('test')) {
    // No coverage script at the gate — sniff the test script's content
    // (read its entrails) for a runner we know how to coax proof out of.
    // Every divined command must emit istanbul's coverage-summary.json:
    // it is the only dialect the sworn js interpreter reads.
    const trial = (scripts.test as string).toLowerCase();
    if (trial.includes('jest')) {
      // jest carries istanbul within; json-summary makes it write the
      // coverage-summary.json the interpreter expects.
      divined.coverageCommand = 'npx jest --coverage --coverageReporters=json-summary';
    } else if (trial.includes('node --test') || trial.includes('node:test')) {
      // node's native runner speaks no istanbul of its own, so c8 wraps the
      // trial and transcribes it into json-summary form.
      divined.coverageCommand = 'npx c8 --reporter=json-summary node --test';
    }
    // else (vitest or an unknown runner): divine nothing — the
    // standard-issue `npx vitest run --coverage` already covers it.
  }

  if (has('test')) {
    divined.testCommand = 'npm test';
  }
  if (has('test:e2e')) {
    divined.e2eCommand = 'npm run test:e2e';
  }
  return divined;
}

/**
 * Merge a steward's scroll over the defaults, keeping only fields of the
 * right shape so a malformed scroll cannot poison the ledger.
 */
export function mergeScrollOverDefaults(
  defaults: GameConfig,
  scroll: Record<string, unknown>
): GameConfig {
  const merged: GameConfig = { ...defaults };
  if (typeof scroll.testCommand === 'string') merged.testCommand = scroll.testCommand;
  if (typeof scroll.coverageCommand === 'string') {
    merged.coverageCommand = scroll.coverageCommand;
  }
  if (typeof scroll.e2eCommand === 'string') merged.e2eCommand = scroll.e2eCommand;
  if (isStringArray(scroll.coverageSummaryGlobs)) {
    merged.coverageSummaryGlobs = scroll.coverageSummaryGlobs;
  }
  if (isStringArray(scroll.sourceGlobs)) merged.sourceGlobs = scroll.sourceGlobs;
  if (isStringArray(scroll.excludeGlobs)) merged.excludeGlobs = scroll.excludeGlobs;
  if (isStringArray(scroll.testGlobs)) merged.testGlobs = scroll.testGlobs;
  if (isLanguage(scroll.language)) merged.language = scroll.language;
  if (isFormat(scroll.coverageFormat)) merged.coverageFormat = scroll.coverageFormat;
  if (isStringArray(scroll.packages)) merged.packages = scroll.packages;
  if (isStringArray(scroll.excludePackages)) {
    merged.excludePackages = scroll.excludePackages;
  }
  // The repo's location is sworn by the caller, never by the scroll.
  merged.repoPath = defaults.repoPath;
  return merged;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

async function applyCargoWorkspaceGlobs(cfg: GameConfig): Promise<GameConfig> {
  const globs = await rustWorkspaceGlobs(cfg.repoPath);
  return globs ? { ...cfg, ...globs } : cfg;
}

async function readJsonScroll(
  absPath: string
): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(absPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    // Missing or illegible scroll — the quartermaster shrugs and moves on.
    return null;
  }
}

/**
 * Resolve the full game config for a target repo:
 * scroll at the gate > detected tongue's kit > package.json divination (js).
 */
export async function resolveConfig(repoPath: string): Promise<GameConfig> {
  const absRepo = path.resolve(repoPath);
  const banners = await readdir(absRepo).catch(() => [] as string[]);
  const detected = detectLanguage(banners);

  const scroll = await readJsonScroll(path.join(absRepo, CONFIG_SCROLL));
  if (scroll) {
    // Order of trust: the scroll's dialect > the scroll's tongue > detection.
    const fromFormat = isFormat(scroll.coverageFormat)
      ? (adapterForFormat(scroll.coverageFormat)?.language ?? null)
      : null;
    const tongue =
      fromFormat ?? (isLanguage(scroll.language) ? scroll.language : detected);
    const defaults = defaultConfig(absRepo, tongue);
    const workspaceDefaults =
      tongue === 'rust' ? await applyCargoWorkspaceGlobs(defaults) : defaults;
    return mergeScrollOverDefaults(workspaceDefaults, scroll);
  }

  const defaults = defaultConfig(absRepo, detected);
  if (detected === 'rust') return applyCargoWorkspaceGlobs(defaults);
  if (detected !== 'js') return defaults;

  const pkg = await readJsonScroll(path.join(absRepo, 'package.json'));
  const scripts =
    pkg && pkg.scripts !== null && typeof pkg.scripts === 'object' && !Array.isArray(pkg.scripts)
      ? (pkg.scripts as Record<string, unknown>)
      : {};
  return { ...defaults, ...guessCommandsFromScripts(scripts) };
}
