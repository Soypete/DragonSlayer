/**
 * The Herald at the Gate — reads the summons (argv) and decides which
 * realm (repo) the knight rides into. Pure: filesystem access is injected.
 */

import { resolve, join } from 'node:path';

export const DEFAULT_DUNGEON = 'practice-dungeon';

/**
 * Resolve the target repo from argv.
 *
 * - `--repo <path>` or `--repo=<path>` points the campaign at that realm.
 * - Otherwise, if `./practice-dungeon` stands in cwd, train there.
 * - Otherwise, the campaign is waged in cwd itself.
 *
 * Always returns an absolute path. `exists` is injected so the herald
 * stays pure and testable.
 */
export function resolveRepoPath(
  argv: string[],
  cwd: string,
  exists: (path: string) => boolean,
): string {
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
  const dungeon = join(cwd, DEFAULT_DUNGEON);
  if (exists(dungeon)) return resolve(dungeon);
  return resolve(cwd);
}
