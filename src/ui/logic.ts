/**
 * The Quartermaster — pure glue between the realm's guilds (modules) and
 * the UI. No clocks, no dice, no I/O: every function here is deterministic.
 */

import type { Dragon, Quest, RepoScan, SaveGame, TypingSnippet } from '../types.js';
import { applyScan } from '../game/state.js';
import { generateQuests } from '../game/quests.js';
import { rankForXp } from '../game/ranks.js';
import { incantations } from '../typing/snippets.js';

/** How many scrolls the knight transcribes per battle. */
export const SCROLLS_PER_BATTLE = 5;

/**
 * Pad a battle's scroll satchel: snippets harvested from the dragon's own
 * lair come first; if the lair is barren, the satchel is topped up with
 * test-flavored incantations aimed at the file.
 */
export function padSnippets(
  harvested: TypingSnippet[],
  file: string,
  count: number,
): TypingSnippet[] {
  const satchel = harvested.slice(0, count);
  if (satchel.length < count) {
    satchel.push(...incantations(file, count - satchel.length));
  }
  return satchel;
}

/** XP owed for quests that flipped to `complete` between two ledgers. */
export function questBountyXp(before: Quest[], after: Quest[]): number {
  const alreadySung = new Set(
    before.filter((q) => q.status === 'complete').map((q) => q.id),
  );
  return after
    .filter((q) => q.status === 'complete' && !alreadySung.has(q.id))
    .reduce((sum, q) => sum + q.xpReward, 0);
}

/**
 * Fold a fresh scan into the chronicle, end to end:
 * 1. regenerate the quest board against the new scan,
 * 2. apply the scan (slain bounties, coverage XP, objective refresh),
 * 3. pay out bounties for quests completed by this very scan.
 *
 * Pure — the caller persists the result with writeSave.
 */
export function chronicleScan(save: SaveGame, scan: RepoScan, dragons: Dragon[]): SaveGame {
  const board = generateQuests(scan, dragons, save.quests);
  const chronicled = applyScan({ ...save, quests: board }, scan, dragons);
  const bounty = questBountyXp(save.quests, chronicled.quests);
  if (bounty === 0) return chronicled;
  const xp = chronicled.xp + bounty;
  return { ...chronicled, xp, gold: chronicled.gold + Math.round(bounty / 10), rank: rankForXp(xp).id };
}

/**
 * Order the dragon roster for the realm map: living beasts first
 * (by lair path), trophies of the slain after.
 */
export function musterRoster(dragons: Dragon[]): Dragon[] {
  const living = dragons.filter((d) => !d.slain).sort((a, b) => a.file.localeCompare(b.file));
  const slain = dragons.filter((d) => d.slain).sort((a, b) => a.file.localeCompare(b.file));
  return [...living, ...slain];
}

/**
 * A sliding window over a long roster so the selected row stays visible.
 * Returns the [start, end) slice bounds.
 */
export function scrollWindow(total: number, selected: number, height: number): [number, number] {
  if (total <= height) return [0, total];
  const clamped = Math.min(Math.max(selected, 0), total - 1);
  let start = clamped - Math.floor(height / 2);
  start = Math.max(0, Math.min(start, total - height));
  return [start, start + height];
}
