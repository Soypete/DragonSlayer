/**
 * The Order of the Coverage Knights — rank ladder.
 *
 * XP is earned by weakening dragons in typing battles and, more nobly, by
 * raising real line coverage. Climb from lowly page to Dragonlord of the
 * Hundred-Percent Realm.
 */

import type { Rank } from '../types.js';

export const RANKS: Rank[] = [
  {
    id: 'page',
    title: 'Page of the Untested Marches',
    minXp: 0,
    sigil: '·',
  },
  {
    id: 'squire',
    title: 'Squire of the First Assertion',
    minXp: 250,
    sigil: '⚔',
  },
  {
    id: 'knight-errant',
    title: 'Knight-Errant of the Red Diff',
    minXp: 750,
    sigil: '🛡',
  },
  {
    id: 'knight',
    title: 'Knight of the Green Suite',
    minXp: 1750,
    sigil: '♞',
  },
  {
    id: 'dragon-knight',
    title: 'Dragon-Knight of the Branchlands',
    minXp: 3500,
    sigil: '🐉',
  },
  {
    id: 'paladin',
    title: 'Paladin of the Passing Pipeline',
    minXp: 6000,
    sigil: '✦',
  },
  {
    id: 'dragonlord',
    title: 'Dragonlord of the Hundred-Percent Realm',
    minXp: 10000,
    sigil: '👑',
  },
];

/** The rank a knight holds at the given XP (highest rank whose minXp ≤ xp). */
export function rankForXp(xp: number): Rank {
  let held = RANKS[0];
  for (const rank of RANKS) {
    if (xp >= rank.minXp) held = rank;
  }
  return held;
}

/** The next rank to strive for, or null when the dragonlord throne is taken. */
export function nextRank(xp: number): Rank | null {
  for (const rank of RANKS) {
    if (xp < rank.minXp) return rank;
  }
  return null;
}
