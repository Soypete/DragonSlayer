/**
 * The Sealing Wax — forge a leaderboard receipt from a chronicle. Pure: every
 * scrap of time, identity, and version rides in as an argument; nothing here
 * reads a clock, a file, or the wall. The IO shell (cli-leaderboard) gathers
 * the inputs and carries the sealed parchment to stdout or a scroll on disk.
 *
 * The `contentHash` proves the parchment was not altered after sealing. It is
 * NOT a signature of identity — the boards confirm authorship by matching the
 * GitHub handle to whoever opens the pull request.
 */

import { createHash } from 'node:crypto';

import type { Receipt, ReceiptTrial, SaveGame } from '../types.js';
import { goldEarnedOn } from './logic.js';

export interface ReceiptInput {
  save: SaveGame;
  /** GitHub login (lowercased upstream). */
  githubHandle: string;
  /** sha1 of the realm's absolute path — the save sigil. */
  repoSigil: string;
  /** Optional realm basename for the boards. */
  repoName?: string;
  /** The realm's version (package.json). */
  gameVersion: string;
  /** The day the receipt reports, YYYY-MM-DD. */
  day: string;
  /** When the receipt is sealed, epoch ms. */
  now: number;
}

/** Every standing trial best, flattened to the board's shape, sorted by id. */
function trialsFromSave(save: SaveGame): ReceiptTrial[] {
  const results = save.vim?.results ?? {};
  return Object.values(results)
    .map((r) => ({
      trialId: r.trialId,
      durationMs: r.durationMs,
      keystrokes: r.keystrokes,
      par: r.par,
      stars: r.stars,
      // Older results carry no stamp; the boards read 0 as "undated".
      completedAt: r.completedAt ?? 0,
    }))
    .sort((a, b) => a.trialId.localeCompare(b.trialId));
}

/**
 * A stable, whitespace-free JSON render of the receipt minus its own hash —
 * the exact bytes the hash is taken over, and the bytes a verifier must
 * reproduce. Keys are emitted in a fixed order so the digest never drifts with
 * object-construction order.
 */
export function canonicalReceipt(receipt: Omit<Receipt, 'contentHash'>): string {
  const ordered = {
    schema: receipt.schema,
    gameVersion: receipt.gameVersion,
    saveVersion: receipt.saveVersion,
    githubHandle: receipt.githubHandle,
    repo: receipt.repo.name === undefined
      ? { sigil: receipt.repo.sigil }
      : { sigil: receipt.repo.sigil, name: receipt.repo.name },
    day: receipt.day,
    goldEarnedThatDay: receipt.goldEarnedThatDay,
    trials: receipt.trials.map((t) => ({
      trialId: t.trialId,
      durationMs: t.durationMs,
      keystrokes: t.keystrokes,
      par: t.par,
      stars: t.stars,
      completedAt: t.completedAt,
    })),
    generatedAt: receipt.generatedAt,
  };
  return JSON.stringify(ordered);
}

/** sha256 hex over the canonical render — the seal that detects tampering. */
export function hashReceipt(receipt: Omit<Receipt, 'contentHash'>): string {
  return createHash('sha256').update(canonicalReceipt(receipt)).digest('hex');
}

/** Seal a chronicle into a receipt for the day's haul and standing speedruns. */
export function buildReceipt(input: ReceiptInput): Receipt {
  const unsealed: Omit<Receipt, 'contentHash'> = {
    schema: 'dragonslayer-receipt/v1',
    gameVersion: input.gameVersion,
    saveVersion: input.save.version,
    githubHandle: input.githubHandle,
    repo: input.repoName === undefined
      ? { sigil: input.repoSigil }
      : { sigil: input.repoSigil, name: input.repoName },
    day: input.day,
    goldEarnedThatDay: goldEarnedOn(input.save.goldLedger, input.day),
    trials: trialsFromSave(input.save),
    generatedAt: input.now,
  };
  return { ...unsealed, contentHash: hashReceipt(unsealed) };
}

/** Re-verify a sealed receipt: does its hash still match its contents? */
export function verifyReceipt(receipt: Receipt): boolean {
  const { contentHash, ...rest } = receipt;
  return hashReceipt(rest) === contentHash;
}
