/**
 * adapter.ts — the Guild of Interpreters.
 *
 * Each tongue the realm can quest in (js, go, python, rust) is served by one
 * sworn interpreter: it knows the standard-issue commands for that toolchain,
 * which binaries those commands need, and how to read the tongue's coverage
 * dialect into the realm's own CoverageData ledger.
 */

import type {
  CoverageData,
  CoverageFormat,
  RepoLanguage,
  ToolRequirement,
} from '../../types.js';
import { goAdapter } from './go.js';
import { istanbulAdapter } from './istanbul.js';
import { pythonAdapter } from './python.js';
import { rustAdapter } from './rust.js';

/** Provenance and hints handed to an interpreter alongside the raw artifact. */
export interface ParseContext {
  /** Absolute path of the repo the artifact testifies for. */
  repoPath: string;
  /** Artifact path relative to the repo root (provenance). */
  source: string;
  /** mtime of the artifact, epoch ms. */
  generatedAt: number;
  /** istanbul only: package dir prefix for monorepo summaries. */
  packageRoot?: string;
  /** go only: module path from go.mod, stripped from coverprofile keys. */
  goModulePath?: string;
}

/** The standard-issue kit an interpreter equips a squire with. */
export interface AdapterDefaults {
  testCommand: string;
  coverageCommand: string;
  coverageSummaryGlobs: string[];
  sourceGlobs: string[];
  excludeGlobs: string[];
  testGlobs: string[];
}

export interface LanguageAdapter {
  language: RepoLanguage;
  coverageFormat: CoverageFormat;
  defaults: AdapterDefaults;
  /** Binaries the default commands need, with install pointers for the player. */
  requiredTools: ToolRequirement[];
  /**
   * Read a raw coverage artifact (TEXT — not every dialect is JSON) into
   * CoverageData. Pure; returns null when the artifact is malformed.
   */
  parseCoverage(raw: string, ctx: ParseContext): CoverageData | null;
}

/** Every interpreter sworn to the guild. New tongues enlist here. */
const GUILD: LanguageAdapter[] = [
  istanbulAdapter,
  goAdapter,
  pythonAdapter,
  rustAdapter,
];

/** The interpreter for a coverage dialect, if one has sworn the oath. */
export function adapterForFormat(format: CoverageFormat): LanguageAdapter | null {
  return GUILD.find((a) => a.coverageFormat === format) ?? null;
}

/**
 * The interpreter for a realm's tongue. A tongue nobody in the guild speaks
 * yet is addressed in the old tongue (istanbul/js) — exactly the behavior
 * every realm received before the guild was founded.
 */
export function adapterForLanguage(language: RepoLanguage): LanguageAdapter {
  return GUILD.find((a) => a.language === language) ?? istanbulAdapter;
}
