/**
 * The Quartermaster — pure glue between the realm's guilds (modules) and
 * the UI. No clocks, no dice, no I/O: every function here is deterministic.
 */

import { resolve } from 'node:path';
import type {
  Augury,
  BattleResult,
  CampaignEntry,
  Dragon,
  GoldEntry,
  Quest,
  RepoScan,
  SaveGame,
  ToolRequirement,
  TrialGoal,
  TrialResult,
  TypingSnippet,
  VimBuffer,
  VimTrial,
} from '../types.js';
import { appendGold, applyScan } from '../game/state.js';
import { generateQuests } from '../game/quests.js';
import { rankForXp } from '../game/ranks.js';
import { incantations } from '../typing/snippets.js';
import { goalMet } from '../vim/engine.js';
import { applyTrial, bladeFor, starsFor, trialXp } from '../vim/trials.js';

/** How many scrolls the knight transcribes per battle. */
export const SCROLLS_PER_BATTLE = 5;

/**
 * One parchment line per blade missing from the armory, duties merged
 * ("tests & coverage") and the first known install pointer kept. Pure.
 */
export function armoryWarnings(missing: ToolRequirement[]): string[] {
  const racks = new Map<string, { duties: string[]; url: string }>();
  for (const tool of missing) {
    const rack = racks.get(tool.binary) ?? { duties: [], url: tool.installUrl };
    if (!rack.duties.includes(tool.neededFor)) rack.duties.push(tool.neededFor);
    if (rack.url === '') rack.url = tool.installUrl;
    racks.set(tool.binary, rack);
  }
  return [...racks.entries()].map(
    ([binary, { duties, url }]) =>
      `${binary} not found in the armory — ${duties.join(' & ')} will fail` +
      (url === '' ? '' : `. Install: ${url}`)
  );
}

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
 * `today` (YYYY-MM-DD, from the UI) dates both the slay bounties applyScan
 * mints and the quest bounty banked here. Pure — the caller persists with writeSave.
 */
export function chronicleScan(
  save: SaveGame,
  scan: RepoScan,
  dragons: Dragon[],
  today: string,
): SaveGame {
  const board = generateQuests(scan, dragons, save.quests);
  const chronicled = applyScan({ ...save, quests: board }, scan, dragons, today);
  const bounty = questBountyXp(save.quests, chronicled.quests);
  if (bounty === 0) return chronicled;
  const xp = chronicled.xp + bounty;
  const questGold = Math.round(bounty / 10);
  return {
    ...chronicled,
    xp,
    gold: chronicled.gold + questGold,
    goldLedger: appendGold(chronicled.goldLedger, today, questGold, 'quest'),
    rank: rankForXp(xp).id,
  };
}

/** Gold minted on a single day, summed from the ledger. Pure. */
export function goldEarnedOn(ledger: GoldEntry[] | undefined, date: string): number {
  return (ledger ?? [])
    .filter((entry) => entry.date === date)
    .reduce((sum, entry) => sum + entry.amount, 0);
}

/**
 * Muster the campaign picker's roll: every chronicled realm (saves) united
 * with every hand-charted one (registry), deduped by absolute path. A save
 * always speaks for its realm; freshest campaigns ride first, then the
 * unplayed in path order. `exists` is injected so the muster stays pure.
 */
export function musterCampaignEntries(
  saves: SaveGame[],
  registryRepos: string[],
  exists: (path: string) => boolean,
): CampaignEntry[] {
  const byPath = new Map<string, CampaignEntry>();
  for (const save of saves) {
    const repoPath = resolve(save.repoPath);
    byPath.set(repoPath, { repoPath, save, exists: exists(repoPath) });
  }
  for (const repo of registryRepos) {
    const repoPath = resolve(repo);
    if (!byPath.has(repoPath)) {
      byPath.set(repoPath, { repoPath, save: null, exists: exists(repoPath) });
    }
  }
  return [...byPath.values()].sort((a, b) => {
    const aStamp = a.save?.lastScan?.timestamp ?? 0;
    const bStamp = b.save?.lastScan?.timestamp ?? 0;
    if (aStamp !== bStamp) return bStamp - aStamp;
    return a.repoPath.localeCompare(b.repoPath);
  });
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

// ── Sword-school glue ────────────────────────────────────────────────────────

/** Gold demanded for the deeper rungs of the hint ladder. */
export const HINT_COST = 5;

/**
 * Toll for revealing hint rung `rung` (0-based). The first rung is a free
 * nudge; rungs 1 and 2 (exact keys, full walkthrough) cost 5 gold — but the
 * guild waives the fee with a sigh when the knight's purse is too light.
 */
export function hintToll(rung: number, gold: number): number {
  if (rung <= 0) return 0;
  return gold >= HINT_COST ? HINT_COST : 0;
}

/**
 * A trial stands fulfilled only at rest: the goal is met, the blade is
 * sheathed (normal mode), and no operator or count hangs half-spoken.
 */
export function trialFulfilled(buffer: VimBuffer, goal: TrialGoal): boolean {
  return (
    buffer.mode === 'normal' &&
    buffer.pendingOperator === null &&
    buffer.pendingCount === null &&
    goalMet(buffer, goal)
  );
}

/**
 * Strike the full TrialResult from a finished scored attempt. `completedAt`
 * (epoch ms, read in the UI when the run lands) dates it for a speedrun receipt.
 */
export function forgeTrialResult(
  trial: VimTrial,
  keystrokes: number,
  hintsUsed: number,
  durationMs: number,
  completedAt: number,
): TrialResult {
  const stars = starsFor(keystrokes, trial.par, hintsUsed);
  return {
    trialId: trial.id,
    keystrokes,
    par: trial.par,
    durationMs,
    hintsUsed,
    stars,
    xpEarned: trialXp(stars, trial.tier),
    blade: bladeFor(stars),
    completedAt,
  };
}

/**
 * Fold a finished trial into the chronicle: best-result bookkeeping and tier
 * gates via applyTrial, XP awarded, rank re-judged — the same spoils path
 * every other XP source walks. Pure; the caller persists with writeSave.
 */
export function chronicleTrial(save: SaveGame, result: TrialResult): SaveGame {
  const vim = applyTrial(save.vim, result);
  const xp = save.xp + Math.max(0, result.xpEarned);
  return { ...save, xp, rank: rankForXp(xp).id, vim };
}

/** A sharpened blade multiplies a battle's damage (the spoils, not the XP math). */
export function sharpenSpoils(result: BattleResult, blade: number): BattleResult {
  if (blade <= 1) return result;
  return { ...result, damage: Math.round(result.damage * blade) };
}

/** The battle consumed the blade buff: dull it back to 1. Old saves pass through. */
export function dullBlade(save: SaveGame): SaveGame {
  if (!save.vim || save.vim.bladeBuff === 1) return save;
  return { ...save, vim: { ...save.vim, bladeBuff: 1 } };
}

/**
 * Render a keystroke sequence for human eyes: spaces become ␣ so the
 * debrief never hides a stroke, tokens like <esc> stay spelled out.
 */
export function scribeKeys(keys: string[]): string {
  return keys.map((k) => (k === ' ' ? '␣' : k)).join('');
}

/** "★★☆" — a trial's stars as glyphs; 0 stars renders three hollow ones. */
export function starGlyphs(stars: number): string {
  const lit = Math.max(0, Math.min(3, Math.floor(stars)));
  return '★'.repeat(lit) + '☆'.repeat(3 - lit);
}

// ── Pledges & the daily augury — guild glue ──────────────────────────────────

/**
 * The local calendar day as YYYY-MM-DD. The Date is read from the wall clock
 * in the UI layer (App) and passed in — this formatter stays pure.
 */
export function localDay(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** A standing blessing sweetens every battle's XP by this factor, same-day only. */
export const BLESSING_XP_MULTIPLIER = 1.1;

/**
 * The daily augury's stake: a BLESSING grants a same-day 1.1× multiplier on
 * battle XP. Applied in the spoils path — App.collectSpoils blesses the
 * BattleResult here BEFORE applyBattle banks the XP — so the bonus rides the
 * same commit as every other battle spoil. Curses, omens, and yesterday's
 * blessings change nothing.
 */
export function blessSpoils(
  result: BattleResult,
  augury: Augury | undefined,
  today: string,
): BattleResult {
  if (!augury || augury.kind !== 'blessing' || augury.date !== today) return result;
  return { ...result, xpEarned: Math.round(result.xpEarned * BLESSING_XP_MULTIPLIER) };
}

/**
 * The realm map's standing reminder of sworn deeds: the first pledged quest's
 * title, with a count when more pledges stand behind it. Null when no pledge
 * still matches a quest on the board.
 */
export function pledgeBanner(quests: Quest[], pledges: string[]): string | null {
  const sworn = new Set(pledges);
  const pledged = quests.filter((q) => sworn.has(q.id));
  if (pledged.length === 0) return null;
  const tail = pledged.length > 1 ? ` (+${pledged.length - 1} more sworn)` : '';
  return `Pledged: ${pledged[0].title}${tail}`;
}

/** The debrief's one-line judgment of a scored attempt. */
export function debriefLine(keystrokes: number, par: number, hintsUsed: number): string {
  if (keystrokes <= par && hintsUsed === 0) {
    return "Flawless form — you matched the masters' stroke count, unaided.";
  }
  if (keystrokes <= par) {
    return 'You matched the stroke count, but the whispered hints dim the third star.';
  }
  if (keystrokes <= par * 2) {
    const spare = keystrokes - par;
    return `Clean work — within twice par. Shave ${spare} stroke${spare === 1 ? '' : 's'} to match the masters.`;
  }
  return 'The deed is done, however bloodied. Study the par scripture and ride again.';
}
