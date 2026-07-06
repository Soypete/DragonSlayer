/**
 * The Courier — the `gme leaderboard` road, outside the Hall of Banners. It
 * never raises the Ink banner; it reads the chronicle, seals a receipt, and
 * rides back to stdout (or a scroll on disk). The wall clock, the filesystem,
 * and process exit all enter through injected deps, so the courier's reasoning
 * stays pure and testable — only `runLeaderboardCli` binds the real world.
 *
 *   gme leaderboard whoami [--set <handle>]
 *   gme leaderboard receipt [--repo <path>] [--day YYYY-MM-DD] [--out <file>|--stdout]
 *   gme leaderboard trials --json
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { VimTrial } from '../types.js';
import { loadIdentity, saveIdentity } from '../game/registry.js';
import { loadSave, repoSigil } from '../game/state.js';
import { TRIALS } from '../vim/trials.js';
import { buildReceipt } from './receipt.js';
import { localDay } from './logic.js';

// ── Argv parsing (pure) ──────────────────────────────────────────────────────

export type LeaderboardCommand =
  | { kind: 'whoami'; set?: string }
  | { kind: 'receipt'; repo?: string; day?: string; out?: string }
  | { kind: 'trials' }
  | { kind: 'help' }
  | { kind: 'error'; message: string };

/** Read `--flag value` / `--flag=value`; returns the value or null. */
function flagValue(args: string[], name: string): string | null {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === name) {
      const next = args[i + 1];
      return next && !next.startsWith('--') ? next : null;
    }
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }
  return null;
}

function hasFlag(args: string[], name: string): boolean {
  return args.some((a) => a === name || a.startsWith(`${name}=`));
}

/**
 * Parse the argv tail AFTER `leaderboard` (so `argv.slice(3)` from process).
 * Pure — returns a command the runner then carries out.
 */
export function parseLeaderboardArgs(rest: string[]): LeaderboardCommand {
  const sub = rest[0];
  const args = rest.slice(1);

  switch (sub) {
    case 'whoami': {
      const set = flagValue(args, '--set');
      if (hasFlag(args, '--set') && set === null) {
        return { kind: 'error', message: '--set needs a GitHub handle, e.g. --set octocat' };
      }
      return set === null ? { kind: 'whoami' } : { kind: 'whoami', set };
    }
    case 'receipt': {
      return {
        kind: 'receipt',
        repo: flagValue(args, '--repo') ?? undefined,
        day: flagValue(args, '--day') ?? undefined,
        out: hasFlag(args, '--stdout') ? undefined : (flagValue(args, '--out') ?? undefined),
      };
    }
    case 'trials':
      return { kind: 'trials' };
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      return { kind: 'help' };
    default:
      return { kind: 'error', message: `unknown leaderboard command: ${sub}` };
  }
}

// ── Catalog projection (pure) ────────────────────────────────────────────────

export interface TrialCatalogEntry {
  id: string;
  tier: number;
  title: string;
  par: number;
}

/** The leaderboard's view of the curriculum: one board per trial. */
export function trialsCatalog(trials: VimTrial[] = TRIALS): TrialCatalogEntry[] {
  return trials.map((t) => ({ id: t.id, tier: t.tier, title: t.title, par: t.par }));
}

export const HELP_TEXT = [
  'gme leaderboard — carry your haul to the boards',
  '',
  '  whoami [--set <handle>]   show or claim your GitHub banner',
  '  receipt [--repo <path>] [--day YYYY-MM-DD] [--out <file>|--stdout]',
  '                            seal a day-haul + speedrun receipt',
  '  trials --json             dump the trial catalog (id, tier, title, par)',
].join('\n');

// ── The IO runner ────────────────────────────────────────────────────────────

export interface LeaderboardDeps {
  /** argv tail after `leaderboard` (process.argv.slice(3)). */
  rest: string[];
  /** The realm the courier rode in from (resolved repo path), for a bare `receipt`. */
  defaultRepo: string;
  /** The realm's version, from package.json. */
  gameVersion: string;
  /** The wall clock, injected so the runner stays testable. */
  now: () => Date;
  print: (line: string) => void;
  printErr: (line: string) => void;
  /** Optional home override for the ~/.gme vault (tests sandbox it). */
  home?: string;
}

/**
 * Carry out a parsed leaderboard command against the real world. Returns a
 * process exit code (0 = sealed, 1 = the courier turned back). All IO lands here.
 */
export function runLeaderboard(deps: LeaderboardDeps): number {
  const command = parseLeaderboardArgs(deps.rest);

  switch (command.kind) {
    case 'help':
      deps.print(HELP_TEXT);
      return 0;

    case 'error':
      deps.printErr(`gme leaderboard: ${command.message}`);
      deps.printErr(HELP_TEXT);
      return 1;

    case 'whoami': {
      if (command.set !== undefined) {
        const handle = command.set.trim().replace(/^@/, '');
        if (handle === '') {
          deps.printErr('gme leaderboard: a banner needs a non-empty handle');
          return 1;
        }
        saveIdentity(handle, deps.now().getTime(), deps.home);
        deps.print(`Banner claimed: ${handle.toLowerCase()}`);
        return 0;
      }
      const identity = loadIdentity(deps.home);
      if (!identity) {
        deps.printErr('No banner yet. Claim one: gme leaderboard whoami --set <handle>');
        return 1;
      }
      deps.print(identity.githubHandle);
      return 0;
    }

    case 'trials':
      deps.print(JSON.stringify({ gameVersion: deps.gameVersion, trials: trialsCatalog() }, null, 2));
      return 0;

    case 'receipt': {
      const identity = loadIdentity(deps.home);
      if (!identity) {
        deps.printErr('No banner yet. Claim one first: gme leaderboard whoami --set <handle>');
        return 1;
      }
      const repoPath = resolve(command.repo ?? deps.defaultRepo);
      const save = loadSave(repoPath, deps.home);
      if (!save) {
        deps.printErr(`No chronicle for ${repoPath} — ride that realm before sealing a receipt.`);
        return 1;
      }
      const now = deps.now();
      const receipt = buildReceipt({
        save,
        githubHandle: identity.githubHandle,
        repoSigil: repoSigil(repoPath),
        gameVersion: deps.gameVersion,
        day: command.day ?? localDay(now),
        now: now.getTime(),
      });
      const json = JSON.stringify(receipt, null, 2);
      if (command.out !== undefined) {
        writeFileSync(resolve(command.out), json, 'utf8');
        deps.print(`Receipt sealed → ${resolve(command.out)}`);
      } else {
        deps.print(json);
      }
      return 0;
    }
  }
}
