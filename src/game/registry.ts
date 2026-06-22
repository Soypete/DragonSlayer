/**
 * The Realm Registry — a hand-editable ledger of known realms at
 * `~/.gme/config.json`. The game adds a repo whenever a campaign opens
 * there; stewards may also write paths in by hand. Unknown fields in the
 * ledger are preserved, since human hands tend it too.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import type { GlobalRegistry, PlayerIdentity } from '../types.js';

/** Where the ledger of realms is kept. */
/**
 * The home under which the `.gme` ledger lives. Defaults to the OS home; tests
 * pass an explicit root so each runs in its own sandbox without touching the
 * process-global $HOME (which would leak between suites sharing a process).
 */
export function registryPath(home?: string): string {
  return join(home ?? homedir(), '.gme', 'config.json');
}

function emptyRegistry(): GlobalRegistry {
  return { version: 1, repos: [] };
}

function parseLedger(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Read the ledger. A missing, corrupt, or ill-shaped file yields an empty
 * registry — the game never refuses to start over a bad ledger.
 */
export function loadRegistry(home?: string): GlobalRegistry {
  let raw: string;
  try {
    raw = readFileSync(registryPath(home), 'utf8');
  } catch {
    return emptyRegistry();
  }
  const ledger = parseLedger(raw);
  if (!ledger) return emptyRegistry();

  const repos = Array.isArray(ledger.repos)
    ? ledger.repos.filter((r): r is string => typeof r === 'string').map((r) => resolve(r))
    : [];
  return { version: 1, repos: [...new Set(repos)] };
}

/** Pure: the registry with one more realm charted (deduped, absolute). */
export function withRepo(registry: GlobalRegistry, repoPath: string): GlobalRegistry {
  const abs = resolve(repoPath);
  if (registry.repos.includes(abs)) return registry;
  return { ...registry, repos: [...registry.repos, abs] };
}

/**
 * Chart a realm into the ledger on disk. No-op when already present.
 * Unknown top-level fields in a legible ledger survive the rewrite.
 */
export function registerRepo(repoPath: string, home?: string): void {
  const abs = resolve(repoPath);
  const path = registryPath(home);

  let ledger: Record<string, unknown> = {};
  try {
    ledger = parseLedger(readFileSync(path, 'utf8')) ?? {};
  } catch {
    // No ledger yet — a fresh one is drawn up below.
  }

  const known = Array.isArray(ledger.repos)
    ? ledger.repos.filter((r): r is string => typeof r === 'string').map((r) => resolve(r))
    : [];
  if (known.includes(abs)) return;

  const next = { ...ledger, version: 1, repos: [...new Set([...known, abs])] };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(next, null, 2), 'utf8');
}

// ── The knight's banner (player identity) ────────────────────────────────────

/** A well-formed banner: a non-empty handle and a registration stamp. */
function parseIdentity(value: unknown): PlayerIdentity | null {
  if (value === null || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.githubHandle !== 'string' || v.githubHandle === '') return null;
  if (typeof v.registeredAt !== 'number') return null;
  return { githubHandle: v.githubHandle, registeredAt: v.registeredAt };
}

/**
 * Read the knight's standing banner from the ledger. Null when none is claimed
 * (or the field is malformed) — the realm prompts for one when it's needed.
 */
export function loadIdentity(home?: string): PlayerIdentity | null {
  let raw: string;
  try {
    raw = readFileSync(registryPath(home), 'utf8');
  } catch {
    return null;
  }
  const ledger = parseLedger(raw);
  if (!ledger) return null;
  return parseIdentity(ledger.identity);
}

/**
 * Claim or re-claim the banner: the handle is folded into the ledger without
 * disturbing the charted realms or any field a steward wrote by hand. The
 * handle is lowercased so it matches a GitHub author case-blind; the stamp
 * rides in from the CLI (no clock read here).
 */
export function saveIdentity(githubHandle: string, registeredAt: number, home?: string): void {
  const path = registryPath(home);

  let ledger: Record<string, unknown> = {};
  try {
    ledger = parseLedger(readFileSync(path, 'utf8')) ?? {};
  } catch {
    // No ledger yet — a fresh one is drawn up below.
  }

  const known = Array.isArray(ledger.repos)
    ? ledger.repos.filter((r): r is string => typeof r === 'string').map((r) => resolve(r))
    : [];
  const identity: PlayerIdentity = {
    githubHandle: githubHandle.trim().toLowerCase(),
    registeredAt,
  };

  const next = { ...ledger, version: 1, repos: [...new Set(known)], identity };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(next, null, 2), 'utf8');
}
