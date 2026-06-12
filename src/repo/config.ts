/**
 * config.ts — the Quartermaster's Ledger.
 *
 * Before a knight rides into a repository, the quartermaster must know which
 * commands summon the trials (tests), which forge the proof of valor
 * (coverage), and where the siege engines (e2e) are kept. The ledger is
 * resolved in three ways, in order of trust:
 *
 *   1. A `gme.config.json` scroll left at the repo gate by its stewards.
 *   2. Divination from the repo's own package.json scripts.
 *   3. The old standard-issue kit every squire carries (vitest defaults).
 */

import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { GameConfig } from '../types.js';

/** The scroll a repo's stewards may leave at the gate to override divination. */
export const CONFIG_SCROLL = 'gme.config.json';

/** Standard-issue kit: what every squire carries when the gate bears no scroll. */
export function defaultConfig(repoPath: string): GameConfig {
  return {
    repoPath,
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
  }
  // else: fall back to the standard-issue `npx vitest run --coverage`.

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
 * scroll at the gate > package.json divination > standard-issue kit.
 */
export async function resolveConfig(repoPath: string): Promise<GameConfig> {
  const absRepo = path.resolve(repoPath);
  const defaults = defaultConfig(absRepo);

  const scroll = await readJsonScroll(path.join(absRepo, CONFIG_SCROLL));
  if (scroll) {
    return mergeScrollOverDefaults(defaults, scroll);
  }

  const pkg = await readJsonScroll(path.join(absRepo, 'package.json'));
  const scripts =
    pkg && pkg.scripts !== null && typeof pkg.scripts === 'object' && !Array.isArray(pkg.scripts)
      ? (pkg.scripts as Record<string, unknown>)
      : {};
  return { ...defaults, ...guessCommandsFromScripts(scripts) };
}
