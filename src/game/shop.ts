/**
 * The Guild Shop & the pledge ledger — gold's sinks, as pure reducers.
 *
 * No clocks, no dice, no I/O: the UI layer wires each purchase to its real
 * effect (the squire's forge, the oracle's token, the whetstone's edge) and
 * persists the returned chronicle with writeSave. Pledging itself is FREE —
 * gold buys only the consumables.
 */

import type { Quest, SaveGame, ShopItemId, VimProgress } from '../types.js';

// ── Price list ───────────────────────────────────────────────────────────────

export const FORGE_SKILL_COST = 25;
export const ORACLE_TOKEN_COST = 50;
export const SHARPENING_STONE_COST = 30;

/** The whetstone hones the blade to at least this edge (matches a 2★ trial). */
export const STONE_BLADE = 1.2;

/** The guild's one line of credit policy, quoted wherever gold runs short. */
export const NO_CREDIT = 'the guild extends no credit';

export interface ShopWare {
  id: ShopItemId;
  name: string;
  cost: number;
  blurb: string;
}

/**
 * The shopfront shelf. (Hint rungs are sold at the sword-school's own
 * counter, mid-trial — they never sit on this shelf.)
 */
export const SHOP_WARES: ShopWare[] = [
  {
    id: 'forge-skill',
    name: 'Forge a Claude skill',
    cost: FORGE_SKILL_COST,
    blurb: 'the squire hammers a SKILL.md for a pledged quest into the target repo',
  },
  {
    id: 'oracle-token',
    name: "Oracle's token",
    cost: ORACLE_TOKEN_COST,
    blurb: 'one extra augury today — the cave speaks past its daily gate',
  },
  {
    id: 'sharpening-stone',
    name: 'Sharpening stone',
    cost: SHARPENING_STONE_COST,
    blurb: 'a ×1.2 blade buff for the next battle, no sword-school sweat',
  },
];

// ── Gold math ────────────────────────────────────────────────────────────────

/** Can the purse bear this price? */
export function canAfford(save: SaveGame, cost: number): boolean {
  return save.gold >= cost;
}

/**
 * Pay the guild. Throws when the purse is short — callers guard with
 * canAfford and gray the ware instead of letting the till see red.
 */
export function spendGold(save: SaveGame, cost: number): SaveGame {
  if (!canAfford(save, cost)) throw new Error(NO_CREDIT);
  return { ...save, gold: save.gold - cost };
}

/** Return gold to the purse (e.g. when a paid-for forging throws). */
export function refundGold(save: SaveGame, cost: number): SaveGame {
  return { ...save, gold: save.gold + cost };
}

/**
 * The sharpening stone: gold out, blade honed to at least ×1.2 for the next
 * battle. Never dulls an already-finer edge (a 3★ ×1.5 survives the stone).
 */
export function applySharpeningStone(save: SaveGame): SaveGame {
  const paid = spendGold(save, SHARPENING_STONE_COST);
  const vim: VimProgress = paid.vim ?? { results: {}, unlockedTier: 1, bladeBuff: 1 };
  return { ...paid, vim: { ...vim, bladeBuff: Math.max(vim.bladeBuff, STONE_BLADE) } };
}

// ── The pledge ledger ────────────────────────────────────────────────────────

/** Has the knight sworn to this deed? */
export function isPledged(save: SaveGame, questId: string): boolean {
  return (save.pledges ?? []).includes(questId);
}

/**
 * Swear (or renounce) a pledge — FREE either way. Old saves without a
 * pledges field gain one; renouncing the last pledge leaves an empty list.
 * (Removing the forged skill on renounce is the UI's errand: renounceSkill.)
 */
export function togglePledge(save: SaveGame, questId: string): SaveGame {
  const pledges = save.pledges ?? [];
  return isPledged(save, questId)
    ? { ...save, pledges: pledges.filter((id) => id !== questId) }
    : { ...save, pledges: [...pledges, questId] };
}

/** Pledged quests still on the board and not yet complete — forgeable. */
export function pledgedIncompleteQuests(save: SaveGame): Quest[] {
  return save.quests.filter((q) => isPledged(save, q.id) && q.status !== 'complete');
}

// ── Mustering the guild board ────────────────────────────────────────────────

const KIND_ORDER: Record<Quest['kind'], number> = {
  slay: 0,
  coverage: 1,
  tdd: 2,
  ci: 3,
  e2e: 4,
  oracle: 5,
};

/**
 * Order the board for display: completed deeds sink to the bottom; within
 * each band, pledged quests float first; then kind, then id — stable, so the
 * cursor never jumps without cause.
 */
export function musterBoard(quests: Quest[], pledges: string[]): Quest[] {
  const sworn = new Set(pledges);
  return [...quests].sort((a, b) => {
    const doneA = a.status === 'complete' ? 1 : 0;
    const doneB = b.status === 'complete' ? 1 : 0;
    if (doneA !== doneB) return doneA - doneB;
    const pledgedA = sworn.has(a.id) ? 0 : 1;
    const pledgedB = sworn.has(b.id) ? 0 : 1;
    if (pledgedA !== pledgedB) return pledgedA - pledgedB;
    if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    return a.id.localeCompare(b.id);
  });
}
