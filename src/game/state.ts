/**
 * The Chronicle — save/load plus the pure reducers that move the campaign
 * forward. All reducers are deterministic: timestamps ride in on the scan,
 * never read from the wall clock.
 */

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import type {
  BattleResult,
  Dragon,
  GoldEntry,
  GoldSource,
  PlayerStats,
  RepoScan,
  SaveGame,
} from '../types.js';
import { rankForXp } from './ranks.js';
import { refreshQuestObjectives } from './quests.js';

/** Gold minted per dragon slain — the realm pays well for true coverage. */
const SLAY_GOLD_BOUNTY = 50;
/** XP per +1% of total line coverage reclaimed. */
const XP_PER_COVERAGE_POINT = 15;

// ── Persistence ──────────────────────────────────────────────────────────────

/**
 * The home under which the `.gme` vault lives. Defaults to the OS home; tests
 * pass an explicit root so each runs in its own sandbox without touching the
 * process-global $HOME (which would leak between suites sharing a process).
 */
function vaultHome(home?: string): string {
  return home ?? homedir();
}

/**
 * The realm's sigil: sha1 of its absolute path. Names the chronicle on disk and
 * stands in for the realm on a receipt (a stable id that leaks no local path).
 */
export function repoSigil(repoPath: string): string {
  return createHash('sha1').update(resolve(repoPath)).digest('hex');
}

/**
 * Where this repo's chronicle is kept:
 * `~/.gme/saves/<sha1-of-abs-repo-path>.json`.
 */
export function savePath(repoPath: string, home?: string): string {
  return join(vaultHome(home), '.gme', 'saves', `${repoSigil(repoPath)}.json`);
}

/**
 * Unseal the chronicle for a repo. Returns null when no save exists or the
 * scroll is corrupted/foreign — a fresh campaign should begin instead.
 */
export function loadSave(repoPath: string, home?: string): SaveGame | null {
  const path = savePath(repoPath, home);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isSaveGame(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Seal the chronicle to disk (mkdir -p on the saves vault). */
export function writeSave(save: SaveGame, home?: string): void {
  const path = savePath(save.repoPath, home);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(save, null, 2), 'utf8');
}

/**
 * Open the whole vault: every legible chronicle in `~/.gme/saves`.
 * Corrupt or foreign scrolls are passed over in silence.
 */
export function listSaves(home?: string): SaveGame[] {
  const vault = join(vaultHome(home), '.gme', 'saves');
  let scrolls: string[];
  try {
    scrolls = readdirSync(vault).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  const saves: SaveGame[] = [];
  for (const scroll of scrolls) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(join(vault, scroll), 'utf8'));
      if (isSaveGame(parsed)) saves.push(parsed);
    } catch {
      // A water-damaged chronicle tells no campaign.
    }
  }
  return saves;
}

function isSaveGame(value: unknown): value is SaveGame {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    typeof v.repoPath === 'string' &&
    typeof v.xp === 'number' &&
    typeof v.gold === 'number' &&
    typeof v.rank === 'string' &&
    Array.isArray(v.dragons) &&
    Array.isArray(v.quests) &&
    typeof v.stats === 'object' &&
    v.stats !== null
  );
}

// ── Fresh campaigns ──────────────────────────────────────────────────────────

function freshStats(): PlayerStats {
  return {
    battles: 0,
    bestWpm: 0,
    bestAccuracy: 0,
    totalKeystrokes: 0,
    dragonsSlain: 0,
  };
}

/** A blank chronicle: a page with no gold, no scars, and every dragon ahead. */
export function newSave(repoPath: string): SaveGame {
  return {
    version: 1,
    repoPath: resolve(repoPath),
    xp: 0,
    gold: 0,
    rank: 'page',
    dragons: [],
    quests: [],
    stats: freshStats(),
  };
}

// ── The daily gold ledger ────────────────────────────────────────────────────

/**
 * Append one stamped coin-stroke to the ledger, skipping empty mints (a zero
 * bounty leaves no mark). Pure: the day rides in, never read from a clock.
 */
export function appendGold(
  ledger: GoldEntry[] | undefined,
  date: string,
  amount: number,
  source: GoldSource,
): GoldEntry[] {
  const base = ledger ?? [];
  if (amount <= 0) return base;
  return [...base, { date, amount, source }];
}

// ── Reducers ─────────────────────────────────────────────────────────────────

/**
 * Fold a fresh scan into the chronicle.
 *
 * - Fresh dragons replace the roster; survivors keep their `weakened` scars.
 * - Dragons absent from the fresh roster whose files still stand were slain
 *   by true coverage: +2×maxHp XP and a gold bounty each.
 * - Coverage gained since the last scan pays +15 XP per +1%.
 * - Quest objectives are re-judged against the new scan.
 *
 * `today` (YYYY-MM-DD, computed in the UI) dates the slay bounties in the gold
 * ledger. It never touches `lastScan.timestamp`, which still rides in on the
 * scan — the reducer reads no clock.
 */
export function applyScan(
  save: SaveGame,
  scan: RepoScan,
  dragons: Dragon[],
  today: string,
): SaveGame {
  const priorById = new Map(save.dragons.map((d) => [d.id, d]));
  const freshIds = new Set(dragons.map((d) => d.id));
  const standingFiles = new Set(scan.sourceFiles);

  // Survivors keep their battle scars (weakened).
  const roster: Dragon[] = dragons.map((dragon) => {
    const prior = priorById.get(dragon.id);
    return prior ? { ...dragon, weakened: prior.weakened } : dragon;
  });

  // Newly slain: previously living, no fresh dragon, file still in the realm
  // (a deleted file is a banishment, not a kill — no bounty for arson).
  const newlySlain = save.dragons.filter(
    (d) => !d.slain && !freshIds.has(d.id) && standingFiles.has(d.file),
  );
  for (const fallen of newlySlain) {
    roster.push({ ...fallen, hp: 0, slain: true, coveragePct: 100 });
  }
  // Already-slain dragons whose files still stand remain as trophies.
  for (const trophy of save.dragons) {
    if (trophy.slain && !freshIds.has(trophy.id) && standingFiles.has(trophy.file)) {
      roster.push(trophy);
    }
  }

  const newCoveragePct = scan.coverage?.totals.lines.pct ?? 0;
  let xpGained = 0;
  let goldGained = 0;

  if (save.lastScan) {
    const delta = newCoveragePct - save.lastScan.coveragePct;
    if (delta > 0) xpGained += Math.round(delta * XP_PER_COVERAGE_POINT);
  }
  for (const fallen of newlySlain) {
    xpGained += 2 * fallen.maxHp;
    goldGained += SLAY_GOLD_BOUNTY;
  }

  const xp = save.xp + xpGained;

  // One coin-stroke per fallen dragon, each stamped with today's date — the
  // ledger remembers the day's slaying even as `gold` keeps only the running sum.
  let goldLedger = save.goldLedger;
  for (const _fallen of newlySlain) {
    goldLedger = appendGold(goldLedger, today, SLAY_GOLD_BOUNTY, 'slay');
  }

  return {
    ...save,
    xp,
    gold: save.gold + goldGained,
    goldLedger,
    rank: rankForXp(xp).id,
    dragons: roster,
    quests: refreshQuestObjectives(save.quests, scan, roster),
    stats: {
      ...save.stats,
      dragonsSlain: save.stats.dragonsSlain + newlySlain.length,
    },
    lastScan: {
      coveragePct: newCoveragePct,
      timestamp: scan.scannedAt,
    },
  };
}

/**
 * Record a typing battle against one dragon. Typing wounds but never kills:
 * the dragon grows `weakened` (cap 1), and the knight pockets XP plus a
 * sliver of gold shaken loose from its hoard.
 *
 * `today` (YYYY-MM-DD, from the UI) dates the looted gold in the ledger.
 */
export function applyBattle(
  save: SaveGame,
  dragonId: string,
  result: BattleResult,
  today: string,
): SaveGame {
  const goldLooted = Math.max(0, Math.round(result.damage / 10));
  const xp = save.xp + Math.max(0, result.xpEarned);

  const dragons = save.dragons.map((dragon) => {
    if (dragon.id !== dragonId || dragon.slain) return dragon;
    const bump = dragon.maxHp > 0 ? result.damage / dragon.maxHp : 1;
    return {
      ...dragon,
      weakened: Math.min(1, dragon.weakened + Math.max(0, bump)),
    };
  });

  return {
    ...save,
    xp,
    gold: save.gold + goldLooted,
    goldLedger: appendGold(save.goldLedger, today, goldLooted, 'battle'),
    rank: rankForXp(xp).id,
    dragons,
    stats: {
      ...save.stats,
      battles: save.stats.battles + 1,
      bestWpm: Math.max(save.stats.bestWpm, result.wpm),
      bestAccuracy: Math.max(save.stats.bestAccuracy, result.accuracy),
      totalKeystrokes: save.stats.totalKeystrokes + result.keystrokes,
    },
  };
}

/**
 * The realm is saved when every line is covered AND an end-to-end patrol
 * walks the gauntlet (Playwright configured with at least one spec).
 */
export function hasWon(_save: SaveGame, scan: RepoScan): boolean {
  return (
    scan.coverage?.totals.lines.pct === 100 &&
    scan.playwright.configured &&
    scan.playwright.specCount >= 1
  );
}
