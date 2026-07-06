import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { BattleResult } from '../types.js';
import { makeDragon, makeScan } from './fixtures.test-helpers.js';
import {
  appendGold,
  applyBattle,
  applyScan,
  hasWon,
  listSaves,
  loadSave,
  newSave,
  repoSigil,
  savePath,
  writeSave,
} from './state.js';

/** A fixed calendar day for stamping the gold ledger in tests. */
const DAY = '2026-06-20';

function battle(overrides: Partial<BattleResult> = {}): BattleResult {
  return {
    wpm: 60,
    accuracy: 0.95,
    durationMs: 30_000,
    keystrokes: 150,
    mistakes: 7,
    damage: 50,
    xpEarned: 40,
    ...overrides,
  };
}

describe('the Chronicle (state)', () => {
  describe('savePath', () => {
    it('lives under ~/.gme/saves with a sha1 sigil', () => {
      const path = savePath('/realm/keep');
      expect(path).toMatch(new RegExp(`\\${sep}.gme\\${sep}saves\\${sep}[0-9a-f]{40}\\.json$`));
    });

    it('resolves relative and absolute paths to the same scroll', () => {
      const abs = savePath(process.cwd());
      const rel = savePath('.');
      expect(rel).toBe(abs);
    });

    it('gives different repos different scrolls', () => {
      expect(savePath('/realm/keep')).not.toBe(savePath('/realm/other-keep'));
    });
  });

  describe('save round-trip', () => {
    // Each test gets its own vault, passed EXPLICITLY to the save functions —
    // no process.env.HOME swap, so suites sharing a process can never leak
    // chronicles into one another's vault (a hazard the mutation runner exposed).
    let vault: string;

    beforeEach(() => {
      vault = mkdtempSync(join(tmpdir(), 'gme-vault-'));
    });

    afterEach(() => {
      rmSync(vault, { recursive: true, force: true });
    });

    it('returns null when no chronicle exists', () => {
      expect(loadSave('/realm/unwritten', vault)).toBeNull();
    });

    it('round-trips a save through JSON safely', () => {
      const save = newSave('/realm/keep');
      save.xp = 1234;
      save.gold = 77;
      save.dragons = [makeDragon('src/lair.ts', { maxHp: 33, weakened: 0.5 })];
      save.lastScan = { coveragePct: 42.42, timestamp: 1_700_000_000_000 };
      writeSave(save, vault);
      expect(loadSave('/realm/keep', vault)).toEqual(save);
    });

    it('overwrites on subsequent writes', () => {
      const save = newSave('/realm/keep');
      writeSave(save, vault);
      const richer = { ...save, gold: 9000 };
      writeSave(richer, vault);
      expect(loadSave('/realm/keep', vault)?.gold).toBe(9000);
    });

    it('lists every legible chronicle in the vault', () => {
      writeSave(newSave('/realm/keep'), vault);
      writeSave(newSave('/realm/other-keep'), vault);
      const saves = listSaves(vault);
      expect(saves.map((s) => s.repoPath).sort()).toEqual([
        '/realm/keep',
        '/realm/other-keep',
      ]);
    });

    it('passes over corrupt and foreign scrolls in silence', () => {
      writeSave(newSave('/realm/keep'), vault);
      const dir = join(vault, '.gme', 'saves');
      writeFileSync(join(dir, 'corrupt.json'), '{not json');
      writeFileSync(join(dir, 'foreign.json'), JSON.stringify({ version: 99 }));
      const saves = listSaves(vault);
      expect(saves).toHaveLength(1);
      expect(saves[0]!.repoPath).toBe('/realm/keep');
    });

    it('returns an empty roster when the vault has never been built', () => {
      expect(listSaves(vault)).toEqual([]);
    });
  });

  describe('newSave', () => {
    it('begins as a penniless page with no dragons and no scars', () => {
      const save = newSave('/realm/keep');
      expect(save).toMatchObject({
        version: 1,
        xp: 0,
        gold: 0,
        rank: 'page',
        dragons: [],
        quests: [],
        stats: { battles: 0, bestWpm: 0, bestAccuracy: 0, totalKeystrokes: 0, dragonsSlain: 0 },
      });
      expect(save.lastScan).toBeUndefined();
    });
  });

  describe('applyScan', () => {
    it('adopts fresh dragons and preserves weakened on survivors', () => {
      const save = {
        ...newSave('/realm/keep'),
        dragons: [makeDragon('src/a.ts', { weakened: 0.7 })],
      };
      const fresh = [makeDragon('src/a.ts'), makeDragon('src/b.ts')];
      const next = applyScan(save, makeScan({ sourceFiles: ['src/a.ts', 'src/b.ts'] }), fresh, DAY);
      expect(next.dragons.find((d) => d.id === 'src/a.ts')?.weakened).toBe(0.7);
      expect(next.dragons.find((d) => d.id === 'src/b.ts')?.weakened).toBe(0);
    });

    it('awards +15 XP per +1% coverage gained since the last scan', () => {
      const save = { ...newSave('/realm/keep'), lastScan: { coveragePct: 40, timestamp: 1 } };
      const next = applyScan(save, makeScan({ totalPct: 50 }), [], DAY);
      expect(next.xp).toBe(150);
    });

    it('pays nothing when coverage slips, and sets no baseline bonus on first scan', () => {
      const slipped = applyScan(
        { ...newSave('/realm/keep'), lastScan: { coveragePct: 80, timestamp: 1 } },
        makeScan({ totalPct: 60 }),
        [],
        DAY,
      );
      expect(slipped.xp).toBe(0);

      const first = applyScan(newSave('/realm/keep'), makeScan({ totalPct: 90 }), [], DAY);
      expect(first.xp).toBe(0);
      expect(first.lastScan).toEqual({ coveragePct: 90, timestamp: 1_700_000_111_000 });
    });

    it('crowns newly slain dragons: +2×maxHp XP, +50 gold, trophy kept', () => {
      const save = {
        ...newSave('/realm/keep'),
        dragons: [makeDragon('src/fallen.ts', { maxHp: 30, weakened: 0.4 })],
      };
      // Fresh roster omits the dragon, but its file still stands → slain.
      const next = applyScan(save, makeScan({ sourceFiles: ['src/fallen.ts'] }), [], DAY);
      expect(next.xp).toBe(60);
      expect(next.gold).toBe(50);
      expect(next.stats.dragonsSlain).toBe(1);
      const trophy = next.dragons.find((d) => d.id === 'src/fallen.ts');
      expect(trophy).toMatchObject({ slain: true, hp: 0, coveragePct: 100 });
      // The day's slaying is stamped in the ledger.
      expect(next.goldLedger).toEqual([{ date: DAY, amount: 50, source: 'slay' }]);
    });

    it('banishes (no bounty) dragons whose files were deleted', () => {
      const save = {
        ...newSave('/realm/keep'),
        dragons: [makeDragon('src/burned.ts', { maxHp: 30 })],
      };
      const next = applyScan(save, makeScan({ sourceFiles: [] }), [], DAY);
      expect(next.xp).toBe(0);
      expect(next.gold).toBe(0);
      expect(next.dragons).toHaveLength(0);
      expect(next.stats.dragonsSlain).toBe(0);
      // A banishment mints no gold, so the ledger stays untouched (undefined).
      expect(next.goldLedger).toBeUndefined();
    });

    it('promotes the knight when scan XP crosses a rank threshold', () => {
      const save = { ...newSave('/realm/keep'), lastScan: { coveragePct: 0, timestamp: 1 } };
      const next = applyScan(save, makeScan({ totalPct: 20 }), [], DAY);
      expect(next.xp).toBe(300);
      expect(next.rank).toBe('squire');
    });

    it('refreshes quest objectives against the new scan', () => {
      const save = newSave('/realm/keep');
      save.quests = [
        {
          id: 'coverage:50',
          kind: 'coverage',
          title: 'Raise the Banner at 50%',
          description: 'halfway',
          objectives: [{ id: 'coverage:50:total', description: '≥50%', done: false }],
          xpReward: 150,
          status: 'available',
        },
      ];
      const next = applyScan(save, makeScan({ totalPct: 55 }), [], DAY);
      expect(next.quests[0].status).toBe('complete');
    });

    it('does not mutate the prior save (pure reducer)', () => {
      const save = newSave('/realm/keep');
      const frozen = JSON.stringify(save);
      applyScan(save, makeScan({ totalPct: 50 }), [makeDragon('src/a.ts')], DAY);
      expect(JSON.stringify(save)).toBe(frozen);
    });
  });

  describe('applyBattle', () => {
    it('adds XP and gold, bumps weakened, and tallies stats', () => {
      const save = {
        ...newSave('/realm/keep'),
        dragons: [makeDragon('src/lair.ts', { maxHp: 100 })],
      };
      const next = applyBattle(save, 'src/lair.ts', battle({ damage: 50, xpEarned: 40 }), DAY);
      expect(next.xp).toBe(40);
      expect(next.gold).toBe(5);
      // Looted gold is stamped into the day's ledger.
      expect(next.goldLedger).toEqual([{ date: DAY, amount: 5, source: 'battle' }]);
      expect(next.dragons[0].weakened).toBe(0.5);
      expect(next.stats).toMatchObject({
        battles: 1,
        bestWpm: 60,
        bestAccuracy: 0.95,
        totalKeystrokes: 150,
      });
    });

    it('caps weakened at 1 no matter how furious the typing', () => {
      const save = {
        ...newSave('/realm/keep'),
        dragons: [makeDragon('src/lair.ts', { maxHp: 10, weakened: 0.9 })],
      };
      const next = applyBattle(save, 'src/lair.ts', battle({ damage: 500 }), DAY);
      expect(next.dragons[0].weakened).toBe(1);
    });

    it('keeps best wpm/accuracy as high-water marks', () => {
      const save = {
        ...newSave('/realm/keep'),
        dragons: [makeDragon('src/lair.ts')],
        stats: { battles: 3, bestWpm: 90, bestAccuracy: 0.99, totalKeystrokes: 1000, dragonsSlain: 0 },
      };
      const next = applyBattle(save, 'src/lair.ts', battle({ wpm: 60, accuracy: 0.8 }), DAY);
      expect(next.stats.bestWpm).toBe(90);
      expect(next.stats.bestAccuracy).toBe(0.99);
      expect(next.stats.battles).toBe(4);
    });

    it('leaves other dragons untouched', () => {
      const save = {
        ...newSave('/realm/keep'),
        dragons: [makeDragon('src/lair.ts'), makeDragon('src/other.ts')],
      };
      const next = applyBattle(save, 'src/lair.ts', battle(), DAY);
      expect(next.dragons.find((d) => d.id === 'src/other.ts')?.weakened).toBe(0);
    });
  });

  describe('appendGold (the daily ledger)', () => {
    it('stamps a fresh ledger from undefined', () => {
      expect(appendGold(undefined, DAY, 12, 'slay')).toEqual([
        { date: DAY, amount: 12, source: 'slay' },
      ]);
    });

    it('appends without disturbing prior strokes', () => {
      const prior = [{ date: '2026-06-19', amount: 5, source: 'battle' as const }];
      const next = appendGold(prior, DAY, 50, 'slay');
      expect(next).toEqual([prior[0], { date: DAY, amount: 50, source: 'slay' }]);
      expect(prior).toHaveLength(1); // pure — the prior array is untouched
    });

    it('mints no stroke for an empty bounty', () => {
      expect(appendGold(undefined, DAY, 0, 'quest')).toEqual([]);
      const prior = [{ date: DAY, amount: 3, source: 'battle' as const }];
      expect(appendGold(prior, DAY, -2, 'quest')).toBe(prior);
    });
  });

  describe('repoSigil', () => {
    it('is a 40-char sha1 hex, stable across relative/absolute paths', () => {
      const sigil = repoSigil('/realm/keep');
      expect(sigil).toMatch(/^[0-9a-f]{40}$/);
      expect(repoSigil(process.cwd())).toBe(repoSigil('.'));
    });

    it('names the save scroll', () => {
      expect(savePath('/realm/keep')).toContain(repoSigil('/realm/keep'));
    });
  });

  describe('hasWon', () => {
    it('demands 100% lines AND a marching e2e patrol', () => {
      const save = newSave('/realm/keep');
      expect(hasWon(save, makeScan({ totalPct: 100, playwrightConfigured: true, specCount: 1 }))).toBe(true);
      expect(hasWon(save, makeScan({ totalPct: 100, playwrightConfigured: true, specCount: 0 }))).toBe(false);
      expect(hasWon(save, makeScan({ totalPct: 100, playwrightConfigured: false, specCount: 2 }))).toBe(false);
      expect(hasWon(save, makeScan({ totalPct: 99.9, playwrightConfigured: true, specCount: 5 }))).toBe(false);
      expect(hasWon(save, makeScan({ noCoverage: true, playwrightConfigured: true, specCount: 5 }))).toBe(false);
    });
  });
});
