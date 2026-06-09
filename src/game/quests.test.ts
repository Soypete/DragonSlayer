import { describe, expect, it } from 'vitest';

import type { Quest } from '../types.js';
import { fileStats, makeDragon, makeScan } from './fixtures.test-helpers.js';
import { generateQuests, refreshQuestObjectives } from './quests.js';

describe('the Quest Ledger', () => {
  describe('generateQuests', () => {
    it('posts slay quests for the five mightiest living dragons only', () => {
      const dragons = [
        makeDragon('src/a.ts', { maxHp: 10 }),
        makeDragon('src/b.ts', { maxHp: 90 }),
        makeDragon('src/c.ts', { maxHp: 50 }),
        makeDragon('src/d.ts', { maxHp: 70 }),
        makeDragon('src/e.ts', { maxHp: 30 }),
        makeDragon('src/f.ts', { maxHp: 5 }),
        makeDragon('src/slain.ts', { maxHp: 999, slain: true, hp: 0 }),
      ];
      const quests = generateQuests(makeScan(), dragons, []);
      const slay = quests.filter((q) => q.kind === 'slay');
      expect(slay).toHaveLength(5);
      expect(slay.map((q) => q.target)).toEqual([
        'src/b.ts',
        'src/d.ts',
        'src/c.ts',
        'src/e.ts',
        'src/a.ts',
      ]);
      // The slain behemoth gets no posting; the runt is squeezed off the board.
      expect(slay.some((q) => q.target === 'src/slain.ts')).toBe(false);
      expect(slay.some((q) => q.target === 'src/f.ts')).toBe(false);
    });

    it('posts the four coverage milestones plus tdd, ci, and e2e orders', () => {
      const quests = generateQuests(makeScan(), [], []);
      const ids = quests.map((q) => q.id);
      expect(ids).toEqual(
        expect.arrayContaining(['coverage:50', 'coverage:75', 'coverage:90', 'coverage:100', 'tdd', 'ci', 'e2e']),
      );
    });

    it('uses deterministic ids so regeneration preserves status', () => {
      const dragons = [makeDragon('src/keep.ts', { maxHp: 40 })];
      const first = generateQuests(makeScan(), dragons, []);
      const taken = first.map((q): Quest => (q.id === 'slay:src/keep.ts' ? { ...q, status: 'active' } : q));
      const second = generateQuests(makeScan(), dragons, taken);
      expect(second.find((q) => q.id === 'slay:src/keep.ts')?.status).toBe('active');
    });

    it('keeps the tdd baseline from the original posting', () => {
      const first = generateQuests(makeScan({ testFiles: ['t/one.test.ts'] }), [], []);
      // Later the realm has 2 test files: the original baseline of 1 must hold,
      // so the quest is now complete rather than re-baselined to 2.
      const later = makeScan({ testFiles: ['t/one.test.ts', 't/two.test.ts'] });
      const second = generateQuests(later, [], first);
      const tdd = second.find((q) => q.id === 'tdd');
      expect(tdd?.status).toBe('complete');
      expect(tdd?.objectives[0]?.done).toBe(true);
    });

    it('retains completed sagas that fell off the board', () => {
      const completed: Quest = {
        id: 'slay:src/gone.ts',
        kind: 'slay',
        title: 'Slay Oldmaw the Untested',
        description: 'A saga already sung.',
        objectives: [{ id: 'slay:src/gone.ts:full-coverage', description: 'done deed', done: true }],
        xpReward: 100,
        status: 'complete',
        target: 'src/gone.ts',
      };
      const quests = generateQuests(makeScan(), [], [completed]);
      expect(quests.find((q) => q.id === 'slay:src/gone.ts')?.status).toBe('complete');
    });

    it('marks ci and e2e quests complete when the realm already has sentries', () => {
      const scan = makeScan({
        workflows: ['.github/workflows/ci.yml'],
        hasTestJob: true,
        playwrightConfigured: true,
        specCount: 3,
      });
      const quests = generateQuests(scan, [], []);
      expect(quests.find((q) => q.id === 'ci')?.status).toBe('complete');
      expect(quests.find((q) => q.id === 'e2e')?.status).toBe('complete');
    });
  });

  describe('refreshQuestObjectives', () => {
    it('completes coverage milestones as the banner rises', () => {
      const quests = generateQuests(makeScan({ totalPct: 10 }), [], []);
      const refreshed = refreshQuestObjectives(quests, makeScan({ totalPct: 80 }), []);
      expect(refreshed.find((q) => q.id === 'coverage:50')?.status).toBe('complete');
      expect(refreshed.find((q) => q.id === 'coverage:75')?.status).toBe('complete');
      expect(refreshed.find((q) => q.id === 'coverage:90')?.status).toBe('available');
      expect(refreshed.find((q) => q.id === 'coverage:100')?.status).toBe('available');
    });

    it('keeps completed quests complete even if coverage later slips', () => {
      const quests = refreshQuestObjectives(
        generateQuests(makeScan({ totalPct: 60 }), [], []),
        makeScan({ totalPct: 60 }),
        [],
      );
      const slipped = refreshQuestObjectives(quests, makeScan({ totalPct: 40 }), []);
      expect(slipped.find((q) => q.id === 'coverage:50')?.status).toBe('complete');
    });

    it('completes a slay quest when its dragon falls', () => {
      const dragon = makeDragon('src/lair.ts', { maxHp: 60 });
      const quests = generateQuests(makeScan(), [dragon], []);
      const slainRoster = [{ ...dragon, slain: true, hp: 0 }];
      const refreshed = refreshQuestObjectives(quests, makeScan(), slainRoster);
      expect(refreshed.find((q) => q.id === 'slay:src/lair.ts')?.status).toBe('complete');
    });

    it('falls back to the coverage scrolls when the dragon record is gone', () => {
      const dragon = makeDragon('src/lair.ts', { maxHp: 60 });
      const quests = generateQuests(makeScan(), [dragon], []);
      const scan = makeScan({ files: [fileStats('src/lair.ts', 60, 60)] });
      const refreshed = refreshQuestObjectives(quests, scan, []);
      expect(refreshed.find((q) => q.id === 'slay:src/lair.ts')?.status).toBe('complete');
    });

    it('marks ci objectives independently', () => {
      const quests = generateQuests(makeScan(), [], []);
      const scan = makeScan({ workflows: ['.github/workflows/lint.yml'], hasTestJob: false });
      const ci = refreshQuestObjectives(quests, scan, []).find((q) => q.id === 'ci');
      expect(ci?.objectives.find((o) => o.id === 'ci:workflows')?.done).toBe(true);
      expect(ci?.objectives.find((o) => o.id === 'ci:test-job')?.done).toBe(false);
      expect(ci?.status).toBe('available');
    });
  });
});
