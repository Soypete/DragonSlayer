/**
 * The Dragon Registry — deterministic naming for the beasts that nest in
 * untested files.
 *
 * Every name is derived purely from the file path (FNV-1a hash, no
 * Math.random) so a dragon keeps its name across scans and save files.
 */

import type { DragonSpecies } from '../types.js';

/** FNV-1a 32-bit — small, stable, and superstition-free. Hashes the FULL path. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Avalanche finisher (murmur3 fmix32). FNV-1a over short, similar paths can
 * leave the low bits — the ones a small `% pool.length` actually reads —
 * correlated; this scrambles every input bit into every output bit so each
 * salted full-path hash picks its pool entry near-uniformly.
 */
function avalanche(hash: number): number {
  let h = hash >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Salted, avalanched hash of the full file path — one per name part. */
function pathHash(salt: string, file: string): number {
  return avalanche(fnv1a(`${salt}:${file}`));
}

const NAME_PREFIXES = [
  'Vex',
  'Gor',
  'Mal',
  'Zar',
  'Thal',
  'Skor',
  'Nyx',
  'Bra',
  'Karg',
  'Vor',
  'Mor',
  'Drak',
  'Fen',
  'Ash',
  'Ur',
  'Quor',
  'Bel',
  'Cro',
  'Dur',
  'Gris',
  'Hex',
  'Ix',
  'Jor',
  'Khal',
  'Lur',
  'Naz',
  'Oth',
  'Pyr',
  'Rag',
  'Syl',
  'Tor',
  'Wyr',
] as const;

const NAME_CORES = [
  '',
  'an',
  'ul',
  'ith',
  'ar',
  'eg',
  'om',
  'yr',
  'esh',
  'ok',
  'und',
  'ax',
] as const;

const NAME_SUFFIXES = [
  'maw',
  'fang',
  'scale',
  'wing',
  'claw',
  'gloom',
  'spire',
  'coil',
  'rend',
  'bane',
  'thorn',
  'ash',
  'gorge',
  'talon',
  'scorch',
  'brood',
  'shade',
  'vein',
  'crag',
  'howl',
] as const;

/** Epithets keyed loosely to how the file might betray you. */
const EPITHETS = [
  'the Untested',
  'the Unasserted',
  'the Never-Mocked',
  'the Coverage-Eater',
  'the Red-Lined',
  'the Unhandled',
  'the Assertionless',
  'the Branch-Hoarder',
  'the Silent Failure',
  'the Stack-Smoker',
  'the Edge-Case Eater',
  'the Regression-Bringer',
  'the Unlinted',
  'the Null-Hearted',
  'the Off-by-One',
  'the Mock-Scorner',
  'the Test-Dodger',
  'the Spec-Shredder',
  'the Branchless',
  'the Uncaught',
  'the Deprecated',
  'the Undocumented',
  'the Heisenbug-Hatcher',
  'the Merge-Mangler',
  'the Refactor-Resister',
  'the Side-Effect Sower',
  'the Race-Runner',
  'the Deadlock Warden',
  'the Memory-Leaker',
  'the Type-Twister',
  'the Cast-Cursed',
  'the Stale-Cached',
  'the Timeout Tyrant',
  'the Exception-Eater',
  'the Promise-Breaker',
  'the Callback-Coiled',
  'the Loop-Lurker',
  'the Boundary-Breaker',
  'the Fixture-Forsaken',
  'the Snapshot-Scorned',
  'the Lint-Defiler',
  'the Schema-Shifter',
  'the Env-Var Eater',
  'the Hotfix Horror',
  'the Patch-Proof',
  'the Ever-Pending',
  'the Half-Covered',
  'the Build-Breaker',
] as const;

const ALL_SPECIES: DragonSpecies[] = [
  'Syntax Wyrm',
  'Null Drake',
  'Race Wyvern',
  'Flaky Hydra',
  'Off-by-One Imp',
  'Regression Behemoth',
  'Legacy Lindworm',
];

/**
 * Flavor the species by where the file lives and what tongue it speaks.
 * Falls back to a hash-picked species so every path gets exactly one beast.
 */
function speciesFor(file: string, hash: number): DragonSpecies {
  const lower = file.toLowerCase();
  if (/(^|\/)(legacy|old|deprecated|vendor)\//.test(lower) || /\.(js|jsx|cjs)$/.test(lower)) {
    return 'Legacy Lindworm';
  }
  if (/(auth|net|http|api|socket|worker|async|queue|sync)/.test(lower)) {
    return 'Race Wyvern';
  }
  if (/(util|helper|math|index|count|loop|range)/.test(lower)) {
    return 'Off-by-One Imp';
  }
  if (/(config|env|option|setting|parse|json)/.test(lower)) {
    return 'Null Drake';
  }
  if (/(retry|cache|random|time|date|clock|flak)/.test(lower)) {
    return 'Flaky Hydra';
  }
  if (/\.(ts|tsx|mts)$/.test(lower) && hash % 2 === 0) {
    return 'Syntax Wyrm';
  }
  return ALL_SPECIES[hash % ALL_SPECIES.length];
}

/**
 * Summon the dragon registered to a file path. Deterministic: the same path
 * always yields the same name and species, so saves stay stable.
 */
export function dragonName(file: string): { name: string; species: DragonSpecies } {
  const hash = fnv1a(file);
  // Each part draws from its own salted + avalanched hash of the FULL path,
  // so the indices are independent and epithet collisions stay rare even
  // across sibling files in the same directory.
  const prefix = NAME_PREFIXES[pathHash('prefix', file) % NAME_PREFIXES.length];
  const core = NAME_CORES[pathHash('core', file) % NAME_CORES.length];
  const suffix = NAME_SUFFIXES[pathHash('suffix', file) % NAME_SUFFIXES.length];
  const epithet = EPITHETS[pathHash('epithet', file) % EPITHETS.length];
  return {
    name: `${prefix}${core}${suffix} ${epithet}`,
    species: speciesFor(file, hash),
  };
}
