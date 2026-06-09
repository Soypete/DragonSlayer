import { describe, expect, it } from 'vitest';

import { RANKS, nextRank, rankForXp } from './ranks.js';

describe('the Order of the Coverage Knights', () => {
  it('posts seven ranks from page to dragonlord', () => {
    expect(RANKS.map((r) => r.id)).toEqual([
      'page',
      'squire',
      'knight-errant',
      'knight',
      'dragon-knight',
      'paladin',
      'dragonlord',
    ]);
  });

  it('sets the XP tithes exactly as decreed', () => {
    expect(RANKS.map((r) => r.minXp)).toEqual([0, 250, 750, 1750, 3500, 6000, 10000]);
  });

  it('gives every rank a title and a sigil', () => {
    for (const rank of RANKS) {
      expect(rank.title.length).toBeGreaterThan(0);
      expect(rank.sigil.length).toBeGreaterThan(0);
    }
  });

  describe('rankForXp', () => {
    it('starts a fresh knight as a page', () => {
      expect(rankForXp(0).id).toBe('page');
    });

    it('holds rank just below the next threshold', () => {
      expect(rankForXp(249).id).toBe('page');
      expect(rankForXp(749).id).toBe('squire');
      expect(rankForXp(9999).id).toBe('paladin');
    });

    it('promotes exactly at the threshold', () => {
      expect(rankForXp(250).id).toBe('squire');
      expect(rankForXp(750).id).toBe('knight-errant');
      expect(rankForXp(1750).id).toBe('knight');
      expect(rankForXp(3500).id).toBe('dragon-knight');
      expect(rankForXp(6000).id).toBe('paladin');
      expect(rankForXp(10000).id).toBe('dragonlord');
    });

    it('keeps the dragonlord throne past 10000 XP', () => {
      expect(rankForXp(1_000_000).id).toBe('dragonlord');
    });
  });

  describe('nextRank', () => {
    it('points a page toward squirehood', () => {
      expect(nextRank(0)?.id).toBe('squire');
    });

    it('shows the next rung mid-ladder', () => {
      expect(nextRank(800)?.id).toBe('knight');
    });

    it('returns null once the throne is taken', () => {
      expect(nextRank(10000)).toBeNull();
      expect(nextRank(99999)).toBeNull();
    });
  });
});
