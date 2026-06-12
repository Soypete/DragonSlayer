/**
 * The Herald at the Gate — reads the summons (argv) and decides which
 * realm (repo) the knight rides into. Pure: filesystem access is injected.
 */

import { resolve, join } from 'node:path';

export const DEFAULT_DUNGEON = 'practice-dungeon';

/**
 * Read a `--repo <path>` or `--repo=<path>` summons from argv.
 * Returns the absolute realm path, or null when no summons was issued.
 */
export function parseRepoFlag(argv: string[], cwd: string): string | null {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--repo') {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) return resolve(cwd, next);
    } else if (arg.startsWith('--repo=')) {
      const value = arg.slice('--repo='.length);
      if (value) return resolve(cwd, value);
    }
  }
  return null;
}

/**
 * The realm the herald would suggest unbidden: `./practice-dungeon` when it
 * stands in cwd (train there), else cwd itself. Always absolute; `exists`
 * is injected so the herald stays pure and testable.
 */
export function suggestRealm(cwd: string, exists: (path: string) => boolean): string {
  const dungeon = join(cwd, DEFAULT_DUNGEON);
  if (exists(dungeon)) return resolve(dungeon);
  return resolve(cwd);
}

/**
 * Resolve the target repo from argv: an explicit `--repo` summons wins,
 * otherwise the herald's suggestion stands.
 */
export function resolveRepoPath(
  argv: string[],
  cwd: string,
  exists: (path: string) => boolean,
): string {
  return parseRepoFlag(argv, cwd) ?? suggestRealm(cwd, exists);
}
