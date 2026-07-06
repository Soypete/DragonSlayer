import { describe, expect, it } from 'vitest';

import type { SaveGame, TrialResult } from '../types.js';
import { newSave } from '../game/state.js';
import { buildReceipt, canonicalReceipt, hashReceipt, verifyReceipt } from './receipt.js';

function trial(id: string, overrides: Partial<TrialResult> = {}): TrialResult {
  return {
    trialId: id,
    keystrokes: 3,
    par: 3,
    durationMs: 2_000,
    hintsUsed: 0,
    stars: 3,
    xpEarned: 30,
    blade: 1.5,
    completedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function saveWith(overrides: Partial<SaveGame> = {}): SaveGame {
  return { ...newSave('/realm/keep'), ...overrides };
}

const INPUT = {
  githubHandle: 'octocat',
  repoSigil: 'a'.repeat(40),
  gameVersion: '0.1.0',
  day: '2026-06-20',
  now: 1_700_000_222_000,
};

describe('buildReceipt — sealing the dispatch', () => {
  it('tallies the day haul and carries the standing trials, id-sorted', () => {
    const save = saveWith({
      goldLedger: [
        { date: '2026-06-20', amount: 50, source: 'slay' },
        { date: '2026-06-20', amount: 5, source: 'battle' },
        { date: '2026-06-19', amount: 99, source: 'battle' },
      ],
      vim: {
        results: {
          't2-strides': trial('t2-strides', { durationMs: 5_000 }),
          't1-footwork': trial('t1-footwork', { durationMs: 1_000 }),
        },
        unlockedTier: 2,
        bladeBuff: 1,
      },
    });
    const receipt = buildReceipt({ save, ...INPUT });

    expect(receipt.schema).toBe('dragonslayer-receipt/v1');
    expect(receipt.goldEarnedThatDay).toBe(55); // only 2026-06-20
    expect(receipt.trials.map((t) => t.trialId)).toEqual(['t1-footwork', 't2-strides']);
    expect(receipt.githubHandle).toBe('octocat');
    expect(receipt.repo).toEqual({ sigil: 'a'.repeat(40) });
  });

  it('reads an absent ledger and absent vim as zero haul, no trials', () => {
    const receipt = buildReceipt({ save: saveWith(), ...INPUT });
    expect(receipt.goldEarnedThatDay).toBe(0);
    expect(receipt.trials).toEqual([]);
  });

  it('treats an unstamped (old) trial result as completedAt 0', () => {
    const old = trial('t1-footwork');
    delete (old as { completedAt?: number }).completedAt;
    const save = saveWith({ vim: { results: { 't1-footwork': old }, unlockedTier: 1, bladeBuff: 1 } });
    expect(buildReceipt({ save, ...INPUT }).trials[0]?.completedAt).toBe(0);
  });

  it('is deterministic — same inputs seal byte-identical receipts', () => {
    const save = saveWith({ goldLedger: [{ date: '2026-06-20', amount: 7, source: 'quest' }] });
    expect(JSON.stringify(buildReceipt({ save, ...INPUT }))).toBe(
      JSON.stringify(buildReceipt({ save, ...INPUT })),
    );
  });

  it('carries an opt-in repo name when given', () => {
    const receipt = buildReceipt({ save: saveWith(), ...INPUT, repoName: 'keep' });
    expect(receipt.repo).toEqual({ sigil: 'a'.repeat(40), name: 'keep' });
  });
});

describe('hashReceipt / verifyReceipt — the seal', () => {
  it('a freshly sealed receipt verifies', () => {
    const receipt = buildReceipt({ save: saveWith(), ...INPUT });
    expect(verifyReceipt(receipt)).toBe(true);
  });

  it('detects tampering with any sealed field', () => {
    const receipt = buildReceipt({
      save: saveWith({ goldLedger: [{ date: '2026-06-20', amount: 50, source: 'slay' }] }),
      ...INPUT,
    });
    expect(verifyReceipt({ ...receipt, goldEarnedThatDay: 9_999 })).toBe(false);
    expect(verifyReceipt({ ...receipt, githubHandle: 'impostor' })).toBe(false);
  });

  it('hashes over canonical bytes, independent of field order', () => {
    const base = buildReceipt({ save: saveWith(), ...INPUT });
    const { contentHash, ...rest } = base;
    // Assemble the same fields in a scrambled declaration order — the canonical
    // render fixes the key order, so the digest is identical.
    const reordered = {
      day: rest.day,
      schema: rest.schema,
      trials: rest.trials,
      repo: rest.repo,
      generatedAt: rest.generatedAt,
      githubHandle: rest.githubHandle,
      goldEarnedThatDay: rest.goldEarnedThatDay,
      gameVersion: rest.gameVersion,
      saveVersion: rest.saveVersion,
    };
    expect(hashReceipt(reordered)).toBe(contentHash);
    expect(canonicalReceipt(reordered)).toBe(canonicalReceipt(rest));
  });
});
