/**
 * detect.ts — the Realm Linguist.
 *
 * Reads the banners flying at the repo gate (manifest files in the root) and
 * names the tongue the realm speaks. Pure: feed it any directory listing.
 */

import type { RepoLanguage } from '../types.js';

/**
 * Banners in order of strongest claim. `package.json` flies over many foreign
 * keeps as mere tooling (docs sites, lint configs), so it speaks last.
 */
const BANNERS: ReadonlyArray<{ files: string[]; language: RepoLanguage }> = [
  { files: ['go.mod'], language: 'go' },
  { files: ['Cargo.toml'], language: 'rust' },
  {
    files: ['pyproject.toml', 'setup.py', 'setup.cfg', 'requirements.txt'],
    language: 'python',
  },
  { files: ['package.json'], language: 'js' },
];

/**
 * Name the realm's tongue from the files at its gate (repo-root entries).
 * A gate with no banner at all defaults to 'js' — the old standard-issue
 * assumption, kept so legacy realms behave exactly as before.
 */
export function detectLanguage(rootEntries: string[]): RepoLanguage {
  const present = new Set(rootEntries);
  for (const { files, language } of BANNERS) {
    if (files.some((file) => present.has(file))) return language;
  }
  return 'js';
}
