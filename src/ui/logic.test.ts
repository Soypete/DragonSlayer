import { describe, expect, it } from 'vitest';
import type {
  CoverageData,
  Dragon,
  Quest,
  RepoScan,
  SaveGame,
  TypingSnippet,
} from '../types.js';
import { newSave } from '../game/state.js';
import {
  padSnippets,
  questBountyXp,
  chronicleScan,
  musterRoster,
  scrollWindow,
  SCROLLS_PER_BATTLE,
} from './logic.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function metric(total: number, covered: number) {
  return { total, covered, pct: total === 0 ? 100 : (covered / total) * 100 };
}

function coverageOf(pct: number): CoverageData {
  const covered = Math.round(pct);
  return {
    files: [],
    totals: {
      lines: metric(100, covered),
      statements: metric(100, covered),
      functions: metric(10, Math.round(pct / 10)),
      branches: metric(10, Math.round(pct / 10)),
    },
    source: 'coverage/coverage-summary.json',
    generatedAt: 1_000,
  };
}

function scanOf(pct: number, overrides: Partial<RepoScan> = {}): RepoScan {
  return {
    repoPath: '/keep/of/greyhollow',
    coverage: coverageOf(pct),
    playwright: { configured: false, specCount: 0 },
    ci: { workflows: [], hasTestJob: false },
    sourceFiles: ['src/moat.ts', 'src/drawbridge.ts'],
    testFiles: ['tests/drawbridge.test.ts'],
    scannedAt: 2_000,
    ...overrides,
  };
}

function dragonOf(file: string, hp: number, slain = false): Dragon {
  return {
    id: file,
    file,
    name: `Vexmaw of ${file}`,
    species: 'Null Drake',
    maxHp: Math.max(hp, 1),
    hp,
    weakened: 0,
    slain,
    coveragePct: slain ? 100 : 0,
  };
}

function questOf(id: string, status: Quest['status'], xpReward = 100): Quest {
  return {
    id,
    kind: 'coverage',
    title: id,
    description: 'a deed',
    objectives: [{ id: `${id}:obj`, description: 'do it', done: status === 'complete' }],
    xpReward,
    status,
  };
}

// ── padSnippets ──────────────────────────────────────────────────────────────

describe('padSnippets — the scroll satchel', () => {
  const scroll = (text: string): TypingSnippet => ({ text, source: 'src/moat.ts:1', kind: 'code' });

  it('keeps harvested scrolls when the lair is rich', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map(scroll);
    expect(padSnippets(five, 'src/moat.ts', SCROLLS_PER_BATTLE)).toEqual(five);
  });

  it('tops up a barren lair with incantations', () => {
    const satchel = padSnippets([scroll('one')], 'src/moat.ts', 3);
    expect(satchel).toHaveLength(3);
    expect(satchel[0]!.kind).toBe('code');
    expect(satchel[1]!.kind).toBe('incantation');
    expect(satchel[2]!.kind).toBe('incantation');
  });

  it('fills entirely from the spellbook when nothing was harvested', () => {
    const satchel = padSnippets([], 'src/moat.ts', SCROLLS_PER_BATTLE);
    expect(satchel).toHaveLength(SCROLLS_PER_BATTLE);
    expect(satchel.every((s) => s.kind === 'incantation')).toBe(true);
  });

  it('trims an overfull harvest down to count', () => {
    const seven = 'abcdefg'.split('').map(scroll);
    expect(padSnippets(seven, 'src/moat.ts', 5)).toHaveLength(5);
  });
});

// ── questBountyXp ────────────────────────────────────────────────────────────

describe('questBountyXp — the guild pays its debts', () => {
  it('pays for quests newly completed', () => {
    const before = [questOf('coverage:50', 'available', 150)];
    const after = [questOf('coverage:50', 'complete', 150)];
    expect(questBountyXp(before, after)).toBe(150);
  });

  it('never pays twice for the same deed', () => {
    const done = [questOf('coverage:50', 'complete', 150)];
    expect(questBountyXp(done, done)).toBe(0);
  });

  it('sums multiple bounties', () => {
    const before = [questOf('coverage:50', 'active', 150), questOf('tdd', 'available', 80)];
    const after = [questOf('coverage:50', 'complete', 150), questOf('tdd', 'complete', 80)];
    expect(questBountyXp(before, after)).toBe(230);
  });

  it('pays for brand-new quests born already complete', () => {
    expect(questBountyXp([], [questOf('ci', 'complete', 120)])).toBe(120);
  });
});

// ── chronicleScan ────────────────────────────────────────────────────────────

describe('chronicleScan — folding a scan into the chronicle', () => {
  it('establishes a baseline on the first scan with no coverage XP', () => {
    const save = newSave('/keep/of/greyhollow');
    const scan = scanOf(40);
    const next = chronicleScan(save, scan, [dragonOf('src/moat.ts', 60)]);
    expect(next.lastScan?.coveragePct).toBeCloseTo(40);
    expect(next.dragons).toHaveLength(1);
    expect(next.quests.length).toBeGreaterThan(0);
  });

  it('is pure — the prior save is untouched', () => {
    const save = newSave('/keep/of/greyhollow');
    const frozen = JSON.parse(JSON.stringify(save)) as SaveGame;
    chronicleScan(save, scanOf(40), [dragonOf('src/moat.ts', 60)]);
    expect(save).toEqual(frozen);
  });

  it('pays quest bounty XP when a scan completes a quest', () => {
    const save = newSave('/keep/of/greyhollow');
    const first = chronicleScan(save, scanOf(40), [dragonOf('src/moat.ts', 60)]);
    const fiftyQuest = first.quests.find((q) => q.id === 'coverage:50');
    expect(fiftyQuest?.status).not.toBe('complete');

    const second = chronicleScan(first, scanOf(60), [dragonOf('src/moat.ts', 40)]);
    const completed = second.quests.find((q) => q.id === 'coverage:50');
    expect(completed?.status).toBe('complete');
    // coverage delta XP (+15/percent * 20) plus the quest bounty.
    expect(second.xp).toBeGreaterThanOrEqual(first.xp + 300 + (completed?.xpReward ?? 0));
    expect(second.rank).toBeDefined();
  });

  it('credits a slain dragon when it vanishes from the fresh roster', () => {
    const save = newSave('/keep/of/greyhollow');
    const first = chronicleScan(save, scanOf(40), [dragonOf('src/moat.ts', 60)]);
    const second = chronicleScan(first, scanOf(100), []);
    const trophy = second.dragons.find((d) => d.id === 'src/moat.ts');
    expect(trophy?.slain).toBe(true);
    expect(trophy?.hp).toBe(0);
    expect(second.gold).toBeGreaterThanOrEqual(first.gold + 50);
  });
});

// ── musterRoster / scrollWindow ──────────────────────────────────────────────

describe('musterRoster — ordering the realm map', () => {
  it('lists living dragons first, trophies after, each by lair path', () => {
    const roster = musterRoster([
      dragonOf('src/z-living.ts', 5),
      dragonOf('src/a-slain.ts', 0, true),
      dragonOf('src/a-living.ts', 9),
    ]);
    expect(roster.map((d) => d.file)).toEqual([
      'src/a-living.ts',
      'src/z-living.ts',
      'src/a-slain.ts',
    ]);
  });
});

describe('scrollWindow — keeping the chosen dragon in sight', () => {
  it('shows everything when the roster fits', () => {
    expect(scrollWindow(3, 0, 10)).toEqual([0, 3]);
  });
  it('centers the selection in long rosters', () => {
    expect(scrollWindow(20, 10, 6)).toEqual([7, 13]);
  });
  it('pins to the top and bottom edges', () => {
    expect(scrollWindow(20, 0, 6)).toEqual([0, 6]);
    expect(scrollWindow(20, 19, 6)).toEqual([14, 20]);
  });
});
