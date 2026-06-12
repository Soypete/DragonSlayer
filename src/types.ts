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
  /**
   * Workspace allow-list: repo-relative dir globs (e.g. "packages/*"). When
   * set, only coverage summaries under matching package dirs join the realm.
   * Include "." to keep a root-level summary.
   */
  packages?: string[];
  /** Workspace deny-list: summaries under matching dirs never join the realm. */
  excludePackages?: string[];
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
  /** Sword-school progress; absent on saves from before the vim trials existed. */
  vim?: VimProgress;
  /** Pledged quest ids (Guild Board pledges). */
  pledges?: string[];
  /** Standing daily augury, if consulted. */
  augury?: Augury;
  lastScan?: {
    coveragePct: number;
    timestamp: number;
  };
}

// ── Vim trials (sword-school) ────────────────────────────────────────────────

export type VimMode = 'normal' | 'insert' | 'operator-pending' | 'search';

export interface VimCursor {
  row: number;
  col: number;
}

export interface VimBuffer {
  lines: string[];
  cursor: VimCursor;
  mode: VimMode;
  /** 'd' | 'c' | 'y' while an operator awaits its motion. */
  pendingOperator: string | null;
  /** Accumulated count prefix (e.g. 3 in `3w`); null when none. */
  pendingCount: number | null;
  /** Unnamed register — last yank/delete, for p/P. Linewise when from dd/yy. */
  register: { text: string[]; linewise: boolean } | null;
  /** Last `/` search term, for n/N. */
  searchTerm: string | null;
  /** In-progress `/` input while mode === 'search'. */
  searchDraft: string;
  /** Last f/F/t/T, for ; and , */
  lastFind: { key: 'f' | 'F' | 't' | 'T'; char: string } | null;
}

export interface VimKeyResult {
  buffer: VimBuffer;
  /** False when the key meant nothing in the current mode (counts as a wasted keystroke). */
  handled: boolean;
}

export type TrialGoal =
  | { kind: 'cursor'; row: number; col: number }
  | { kind: 'text'; lines: string[] };

export interface VimTrial {
  id: string;
  /** 1..6, gated progression. */
  tier: number;
  title: string;
  /** Lesson card shown before the first attempt. */
  lesson: {
    heading: string;
    /** Plain-language explanation a vim novice can follow. */
    body: string;
    /** Keystroke sequence demonstrated on the card, e.g. "ciw". */
    demoKeys: string;
  };
  /** Keys/concepts this trial introduces, e.g. ['c', 'iw']. */
  keysTaught: string[];
  startLines: string[];
  startCursor: VimCursor;
  goal: TrialGoal;
  /** Keystrokes in the ideal solution. */
  par: number;
  /** The ideal sequence, parseable by keysFromString, e.g. "3wciwhydra<esc>". */
  parSolution: string;
  /** Hint ladder: nudge → exact keys → full walkthrough. */
  hints: [string, string, string];
}

export interface TrialResult {
  trialId: string;
  keystrokes: number;
  par: number;
  durationMs: number;
  /** 0..3 rungs of the hint ladder used. */
  hintsUsed: number;
  /** 3 = par or better w/o hints, 2 = within 2x par, 1 = completed. */
  stars: 1 | 2 | 3;
  xpEarned: number;
  /** Sharpened-blade damage multiplier earned for the next typing battle (1..1.5). */
  blade: number;
}

export interface VimProgress {
  /** Best result per trial id. */
  results: Record<string, TrialResult>;
  /** Highest tier the knight may attempt. */
  unlockedTier: number;
  /** Active sharpened-blade buff; consumed by the next battle, 1 = none. */
  bladeBuff: number;
}

// ── Pledges, augury, and the guild shop ──────────────────────────────────────

export type AuguryKind = 'blessing' | 'curse' | 'omen';

export interface Augury {
  /** Local calendar date of the consultation, YYYY-MM-DD. */
  date: string;
  kind: AuguryKind;
  /** The style edict written into agent-harness instruction files. */
  edict: string;
  /** Flavor proclamation shown in the cave. */
  proclamation: string;
  /** Metric snapshot at augury time, for judging redemption tomorrow. */
  snapshot: { coveragePct: number; testFiles: number; dragonsSlain: number };
  /** Set by the NEXT augury: was the edict honored while it stood? */
  honored?: boolean;
  source: 'claude' | 'fallback';
}

export interface SkillForgeResult {
  /** Absolute path of the generated SKILL.md. */
  path: string;
  source: 'claude' | 'fallback';
}

export type ShopItemId = 'forge-skill' | 'hint-rung' | 'oracle-token' | 'sharpening-stone';

// ── Command running ──────────────────────────────────────────────────────────

export interface CommandRun {
  command: string;
  cwd: string;
  exitCode: number;
  /** Combined stdout+stderr, tail-truncated to a sane length. */
  output: string;
  durationMs: number;
}
