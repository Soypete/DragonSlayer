/**
 * paths.ts — the Cartographer's Compass.
 *
 * Coverage artifacts speak of files in many accents: absolute paths, windows
 * separators, module-prefixed keys. Everything in the realm is filed under
 * repo-relative posix paths, and this compass points the way there.
 */

import * as path from 'node:path';

export const looksRooted = (p: string): boolean =>
  path.posix.isAbsolute(p) || /^[A-Za-z]:\//.test(p);

/** Translate any path an artifact speaks (absolute, windows) into repo-relative posix. */
export function toRepoRelativePosix(key: string, repoPath: string): string {
  const slashed = key.replace(/\\/g, '/');
  const rootSlashed = repoPath.replace(/\\/g, '/');
  const root = looksRooted(rootSlashed)
    ? rootSlashed.replace(/\/+$/, '')
    : path.resolve(repoPath).replace(/\\/g, '/');
  const rel = looksRooted(slashed) ? path.posix.relative(root, slashed) : slashed;
  return rel.replace(/^\.\//, '');
}

/**
 * The module directive from a go.mod, e.g. "github.com/realm/keep" — go
 * coverprofiles file everything under this prefix. Null when absent.
 */
export function parseGoModulePath(goModText: string): string | null {
  const m = /^\s*module\s+(\S+)/m.exec(goModText);
  return m?.[1] ?? null;
}
