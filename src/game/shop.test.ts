/**
 * The Guild Shop ledger — gold math, the no-credit policy, the whetstone,
 * and the pledge ledger. Pure reducers, pure tests.
 */

import { describe, expect, it } from 'vitest';
import type { Quest, QuestKind, QuestStatus, SaveGame } from '../types.js';
import { newSave } from './state.js';
import {
  FORGE_SKILL_COST,
  NO_CREDIT,
  ORACLE_TOKEN_COST,
  SHARPENING_STONE_COST,
  SHOP_WARES,
  STONE_BLADE,
  applySharpeningStone,
  canAfford,
  isPledged,
  musterBoard,
  pledgedIncompleteQuests,
  refundGold,
  spendGold,
  togglePledge,
} from './shop.js';

function quest(id: string, kind: QuestKind = 'slay', status: QuestStatus = 'available'): Quest {
  return {
    id,
    kind,
    title: `Deed of ${id}`,
    description: 'a deed posted on the board',
    objectives: [{ id: `${id}:obj`, description: 'do the thing', done: false }],
    xpReward: 100,
    status,
  };
}

function purse(gold: number, extra: Partial<SaveGame> = {}): SaveGame {
  return { ...newSave('/realm/keep'), gold, ...extra };
}

describe('the shopfront shelf', () => {
  it('prices the wares per the guild charter', () => {
    const prices = Object.fromEntries(SHOP_WARES.map((w) => [w.id, w.cost]));
    expect(prices['forge-skill']).toBe(FORGE_SKILL_COST);
    expect(prices['oracle-token']).toBe(ORACLE_TOKEN_COST);
    expect(prices['sharpening-stone']).toBe(SHARPENING_STONE_COST);
    expect(FORGE_SKILL_COST).toBe(25);
    expect(ORACLE_TOKEN_COST).toBe(50);
    expect(SHARPENING_STONE_COST).toBe(30);
  });
});

describe('gold math — spend, refund, and the no-credit policy', () => {
  it('judges affordability at the exact boundary', () => {
    expect(canAfford(purse(25), 25)).toBe(true);
    expect(canAfford(purse(24), 25)).toBe(false);
  });
  it('debits the purse without touching the rest of the chronicle', () => {
    const save = purse(40, { xp: 99 });
    const paid = spendGold(save, FORGE_SKILL_COST);
    expect(paid.gold).toBe(15);
    expect(paid.xp).toBe(99);
    expect(save.gold).toBe(40); // pure — the prior save is untouched
  });
  it('extends no credit: a short purse throws', () => {
    expect(() => spendGold(purse(10), FORGE_SKILL_COST)).toThrowError(NO_CREDIT);
  });
  it('refunds in full when a purchase collapses', () => {
    const debited = spendGold(purse(30), FORGE_SKILL_COST);
    expect(refundGold(debited, FORGE_SKILL_COST).gold).toBe(30);
  });
});

describe('the sharpening stone', () => {
  it('costs 30 gold and hones a bare save to ×1.2', () => {
    const honed = applySharpeningStone(purse(30));
    expect(honed.gold).toBe(0);
    expect(honed.vim?.bladeBuff).toBe(STONE_BLADE);
    expect(honed.vim?.unlockedTier).toBe(1);
  });
  it('raises a dull edge to ×1.2 but never dulls a finer one', () => {
    const dull = purse(60, { vim: { results: {}, unlockedTier: 3, bladeBuff: 1 } });
    expect(applySharpeningStone(dull).vim?.bladeBuff).toBe(STONE_BLADE);
    const keen = purse(60, { vim: { results: {}, unlockedTier: 3, bladeBuff: 1.5 } });
    expect(applySharpeningStone(keen).vim?.bladeBuff).toBe(1.5);
  });
  it('keeps the sword-school progress it found', () => {
    const save = purse(30, { vim: { results: {}, unlockedTier: 4, bladeBuff: 1 } });
    expect(applySharpeningStone(save).vim?.unlockedTier).toBe(4);
  });
  it('extends no credit for the stone either', () => {
    expect(() => applySharpeningStone(purse(29))).toThrowError(NO_CREDIT);
  });
});

describe('the pledge ledger — free to swear, free to renounce', () => {
  it('pledges a quest on an old save without a pledges field', () => {
    const save = purse(0);
    expect(save.pledges).toBeUndefined();
    const sworn = togglePledge(save, 'slay:src/moat.ts');
    expect(sworn.pledges).toEqual(['slay:src/moat.ts']);
    expect(isPledged(sworn, 'slay:src/moat.ts')).toBe(true);
    expect(sworn.gold).toBe(0); // pledging is FREE
  });
  it('toggles back off, sparing the other pledges', () => {
    const sworn = purse(0, { pledges: ['a', 'b'] });
    const renounced = togglePledge(sworn, 'a');
    expect(renounced.pledges).toEqual(['b']);
    expect(isPledged(renounced, 'a')).toBe(false);
  });
  it('round-trips: toggle twice and the ledger reads as before', () => {
    const save = purse(0, { pledges: ['a'] });
    expect(togglePledge(togglePledge(save, 'b'), 'b').pledges).toEqual(['a']);
  });
  it('lists only pledged, incomplete quests as forgeable', () => {
    const save = purse(0, {
      quests: [quest('a'), quest('b', 'coverage', 'complete'), quest('c')],
      pledges: ['a', 'b'],
    });
    expect(pledgedIncompleteQuests(save).map((q) => q.id)).toEqual(['a']);
  });
});

describe('musterBoard — pledged first, the finished sink last', () => {
  it('floats pledged quests to the top within the unfinished band', () => {
    const board = musterBoard(
      [quest('slay:a'), quest('cov:50', 'coverage'), quest('slay:b')],
      ['slay:b'],
    );
    expect(board.map((q) => q.id)).toEqual(['slay:b', 'slay:a', 'cov:50']);
  });
  it('keeps completed deeds at the bottom even when pledged', () => {
    const board = musterBoard(
      [quest('done', 'slay', 'complete'), quest('open', 'coverage')],
      ['done'],
    );
    expect(board.map((q) => q.id)).toEqual(['open', 'done']);
  });
  it('orders unpledged deeds by kind then id, as the board always has', () => {
    const board = musterBoard(
      [quest('z', 'e2e'), quest('m', 'coverage'), quest('a', 'slay')],
      [],
    );
    expect(board.map((q) => q.id)).toEqual(['a', 'm', 'z']);
  });
});
