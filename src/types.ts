/**
 * Shared domain contract for Dragonslayer (gme).
 * Every module imports from here; modules never import from each other
 * (except the UI layer, which imports everything).
 */

// ── Ranks ────────────────────────────────────────────────────────────────────

export type RankId =
  | 'page'
  | 'squire'
  | 'knight-errant'
  | 'knight'
  | 'dragon-knight'
  | 'paladin'
  | 'dragonlord';

export interface Rank {
  id: RankId;
  title: string;
  minXp: number;
  /** Single glyph/emoji shown next to the player name. */
  sigil: string;
}

// ── Coverage & repo scanning ─────────────────────────────────────────────────

export interface CoverageMetric {
  total: number;
  covered: number;
  pct: number;
}

export interface CoverageFileStats {
  /** Path relative to the repo root, posix separators. */
  path: string;
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
}

export interface CoverageData {
  files: CoverageFileStats[];
  totals: Omit<CoverageFileStats, 'path'>;
  /** Where this came from, e.g. "coverage/coverage-summary.json". */
  source: string;
  /** mtime of the summary file, epoch ms. */
  generatedAt: number;
}

export interface PlaywrightInfo {
  configured: boolean;
  configPath?: string;
  specCount: number;
}

export interface CiInfo {
  /** Workflow file paths relative to repo root. */
  workflows: string[];
  /** True if any workflow appears to run tests. */
  hasTestJob: boolean;
}

export interface RepoScan {
  repoPath: string;
  coverage: CoverageData | null;
  playwright: PlaywrightInfo;
  ci: CiInfo;
  /** Source files eligible to host dragons (relative posix paths). */
  sourceFiles: string[];
  /** Test files found (relative posix paths). */
  testFiles: string[];
  scannedAt: number;
}

// ── Game config (per target repo) ────────────────────────────────────────────

export interface GameConfig {
  /** Absolute path to the repo being quested. */
  repoPath: string;
  /** Command that runs unit tests, executed with cwd=repoPath. */
  testCommand: string;
  /** Command that produces coverage incl. a json-summary reporter. */
  coverageCommand: string;
  /** Optional command for the end-to-end suite. */
  e2eCommand?: string;
  /** Globs (relative to repoPath) to locate coverage-summary.json files. */
  coverageSummaryGlobs: string[];
  /** Globs selecting source files that can host dragons. */
  sourceGlobs: string[];
  /** Globs excluded from dragon-hosting (tests, generated, vendored). */
  excludeGlobs: string[];
}

// ── Dragons ──────────────────────────────────────────────────────────────────

export type DragonSpecies =
  | 'Syntax Wyrm'
  | 'Null Drake'
  | 'Race Wyvern'
  | 'Flaky Hydra'
  | 'Off-by-One Imp'
  | 'Regression Behemoth'
  | 'Legacy Lindworm';

export interface Dragon {
  /** Stable id: the file path relative to repo root. */
  id: string;
  file: string;
  /** Deterministic fantasy name derived from the file path. */
  name: string;
  species: DragonSpecies;
  /** HP = uncovered lines at last scan (min 1). Slain at 0, i.e. 100% coverage. */
  maxHp: number;
  hp: number;
  /** 0..1 — how exposed the dragon is from typing battles (cosmetic + XP multiplier). */
  weakened: number;
  slain: boolean;
  /** Line coverage pct at last scan. */
  coveragePct: number;
}

// ── Quests ───────────────────────────────────────────────────────────────────

export type QuestKind = 'slay' | 'tdd' | 'coverage' | 'ci' | 'e2e' | 'oracle';
export type QuestStatus = 'available' | 'active' | 'complete';

export interface QuestObjective {
  id: string;
  description: string;
  done: boolean;
}

export interface Quest {
  id: string;
  kind: QuestKind;
  title: string;
  description: string;
  objectives: QuestObjective[];
  xpReward: number;
  status: QuestStatus;
  /** File path for file-targeted quests (slay/tdd). */
  target?: string;
}

// ── Typing battles ───────────────────────────────────────────────────────────

export interface TypingSnippet {
  /** The text the player must type. Single or few lines, ≤ ~180 chars. */
  text: string;
  /** Where it came from, e.g. "src/moat/auth.ts:42" or "incantation". */
  source: string;
  kind: 'code' | 'test' | 'incantation';
}

export interface KeystrokeResult {
  /** Char expected vs received already applied; true if it matched. */
  correct: boolean;
  /** Whole snippet finished after this keystroke. */
  finished: boolean;
}

export interface BattleResult {
  wpm: number;
  /** 0..1 */
  accuracy: number;
  durationMs: number;
  keystrokes: number;
  mistakes: number;
  /** Damage dealt this battle, derived from wpm * accuracy and snippet length. */
  damage: number;
  xpEarned: number;
}

// ── Oracle (AI-assisted discovery) ───────────────────────────────────────────

export interface OracleProphecy {
  /** Files the oracle deems most dangerous, in priority order. */
  hotspots: Array<{ file: string; reason: string }>;
  /** Flavor text shown in the UI. */
  proclamation: string;
  /** 'claude' when the claude CLI answered, 'fallback' for the heuristic. */
  source: 'claude' | 'fallback';
}

// ── Save game ────────────────────────────────────────────────────────────────

export interface PlayerStats {
  battles: number;
  bestWpm: number;
  bestAccuracy: number;
  totalKeystrokes: number;
  dragonsSlain: number;
}

export interface SaveGame {
  version: 1;
  repoPath: string;
  xp: number;
  gold: number;
  rank: RankId;
  dragons: Dragon[];
  quests: Quest[];
  stats: PlayerStats;
  lastScan?: {
    coveragePct: number;
    timestamp: number;
  };
}

// ── Command running ──────────────────────────────────────────────────────────

export interface CommandRun {
  command: string;
  cwd: string;
  exitCode: number;
  /** Combined stdout+stderr, tail-truncated to a sane length. */
  output: string;
  durationMs: number;
}
