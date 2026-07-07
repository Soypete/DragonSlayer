import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Receipt } from '../types.js';
import { newSave, writeSave } from '../game/state.js';
import { saveIdentity } from '../game/registry.js';
import { verifyReceipt } from './receipt.js';
import {
  HELP_TEXT,
  parseLeaderboardArgs,
  runLeaderboard,
  trialsCatalog,
  type LeaderboardDeps,
} from './cli-leaderboard.js';

describe('parseLeaderboardArgs (pure)', () => {
  it('reads whoami with and without --set', () => {
    expect(parseLeaderboardArgs(['whoami'])).toEqual({ kind: 'whoami' });
    expect(parseLeaderboardArgs(['whoami', '--set', 'OctoCat'])).toEqual({
      kind: 'whoami',
      set: 'OctoCat',
    });
    expect(parseLeaderboardArgs(['whoami', '--set=octocat'])).toEqual({
      kind: 'whoami',
      set: 'octocat',
    });
  });

  it('flags a dangling --set', () => {
    expect(parseLeaderboardArgs(['whoami', '--set'])).toMatchObject({ kind: 'error' });
  });

  it('reads receipt flags, with --stdout overriding --out', () => {
    expect(parseLeaderboardArgs(['receipt', '--repo', '/r', '--day', '2026-06-20', '--out', 'f.json'])).toEqual({
      kind: 'receipt',
      repo: '/r',
      day: '2026-06-20',
      out: 'f.json',
    });
    expect(parseLeaderboardArgs(['receipt', '--out', 'f.json', '--stdout'])).toEqual({
      kind: 'receipt',
      repo: undefined,
      day: undefined,
      out: undefined,
    });
  });

  it('routes trials, help, and the unknown', () => {
    expect(parseLeaderboardArgs(['trials'])).toEqual({ kind: 'trials' });
    expect(parseLeaderboardArgs([])).toEqual({ kind: 'help' });
    expect(parseLeaderboardArgs(['--help'])).toEqual({ kind: 'help' });
    expect(parseLeaderboardArgs(['conquer'])).toMatchObject({ kind: 'error' });
  });
});

describe('trialsCatalog (pure)', () => {
  it('projects each trial to id/tier/title/par', () => {
    const sample = [
      {
        id: 't1-x',
        tier: 1,
        title: 'X',
        par: 3,
        lesson: { heading: '', body: '', demoKeys: '' },
        keysTaught: [],
        startLines: [''],
        startCursor: { row: 0, col: 0 },
        goal: { kind: 'cursor' as const, row: 0, col: 0 },
        parSolution: '',
        hints: ['', '', ''] as [string, string, string],
      },
    ];
    expect(trialsCatalog(sample)).toEqual([{ id: 't1-x', tier: 1, title: 'X', par: 3 }]);
  });
});

describe('runLeaderboard (IO, sandboxed)', () => {
  let home: string;
  let out: string[];
  let err: string[];

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'gme-cli-'));
    out = [];
    err = [];
  });

  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
  });

  function deps(rest: string[], extra: Partial<LeaderboardDeps> = {}): LeaderboardDeps {
    return {
      rest,
      defaultRepo: '/realm/keep',
      gameVersion: '0.1.0',
      now: () => new Date('2026-06-20T12:00:00Z'),
      print: (l) => out.push(l),
      printErr: (l) => err.push(l),
      home,
      ...extra,
    };
  }

  it('claims and then reads back a banner', () => {
    expect(runLeaderboard(deps(['whoami', '--set', 'OctoCat']))).toBe(0);
    out = [];
    expect(runLeaderboard(deps(['whoami']))).toBe(0);
    expect(out).toEqual(['octocat']);
  });

  it('reports no banner before one is claimed', () => {
    expect(runLeaderboard(deps(['whoami']))).toBe(1);
    expect(err.join('\n')).toMatch(/claim one/i);
  });

  it('dumps the trial catalog as JSON', () => {
    expect(runLeaderboard(deps(['trials']))).toBe(0);
    const parsed = JSON.parse(out.join('\n')) as { gameVersion: string; trials: unknown[] };
    expect(parsed.gameVersion).toBe('0.1.0');
    expect(parsed.trials.length).toBeGreaterThan(0);
  });

  it('refuses a receipt without a banner', () => {
    writeSave(newSave('/realm/keep'), home);
    expect(runLeaderboard(deps(['receipt', '--repo', '/realm/keep']))).toBe(1);
    expect(err.join('\n')).toMatch(/banner/i);
  });

  it('refuses a receipt for a realm with no chronicle', () => {
    saveIdentity('octocat', 1, home);
    expect(runLeaderboard(deps(['receipt', '--repo', '/realm/unseen']))).toBe(1);
    expect(err.join('\n')).toMatch(/no chronicle/i);
  });

  it('seals a verifiable receipt to stdout for a chronicled realm', () => {
    saveIdentity('octocat', 1, home);
    writeSave(
      { ...newSave('/realm/keep'), goldLedger: [{ date: '2026-06-20', amount: 50, source: 'slay' }] },
      home,
    );
    expect(runLeaderboard(deps(['receipt', '--repo', '/realm/keep', '--stdout']))).toBe(0);
    const receipt = JSON.parse(out.join('\n')) as Receipt;
    expect(receipt.githubHandle).toBe('octocat');
    expect(receipt.day).toBe('2026-06-20');
    expect(receipt.goldEarnedThatDay).toBe(50);
    expect(verifyReceipt(receipt)).toBe(true);
  });

  it('writes the receipt to --out when asked', () => {
    saveIdentity('octocat', 1, home);
    writeSave(newSave('/realm/keep'), home);
    const file = join(home, 'receipt.json');
    expect(runLeaderboard(deps(['receipt', '--repo', '/realm/keep', '--out', file]))).toBe(0);
    const receipt = JSON.parse(readFileSync(file, 'utf8')) as Receipt;
    expect(verifyReceipt(receipt)).toBe(true);
    expect(out.join('\n')).toContain(file);
  });

  it('forges missing directories on the way to --out', () => {
    saveIdentity('octocat', 1, home);
    writeSave(newSave('/realm/keep'), home);
    const file = join(home, 'receipts', 'nested', 'octocat-2026-06-20.json');
    expect(runLeaderboard(deps(['receipt', '--repo', '/realm/keep', '--out', file]))).toBe(0);
    const receipt = JSON.parse(readFileSync(file, 'utf8')) as Receipt;
    expect(verifyReceipt(receipt)).toBe(true);
  });

  it('prints help on a bare invocation and errors on the unknown', () => {
    expect(runLeaderboard(deps([]))).toBe(0);
    expect(out.join('\n')).toBe(HELP_TEXT);
    expect(runLeaderboard(deps(['conquer']))).toBe(1);
  });
});
