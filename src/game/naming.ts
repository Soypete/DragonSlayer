/**
 * The Dragon Registry — deterministic naming for the beasts that nest in
 * untested files.
 *
 * Every name is derived purely from the file path (FNV-1a hash, no
 * Math.random) so a dragon keeps its name across scans and save files.
 */

import type { DragonSpecies } from '../types.js';

/** FNV-1a 32-bit — small, stable, and superstition-free. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
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
  // Derive independent indices from different hash mixes so the parts don't
  // move in lockstep across similar paths.
  const prefix = NAME_PREFIXES[hash % NAME_PREFIXES.length];
  const core = NAME_CORES[fnv1a(`core:${file}`) % NAME_CORES.length];
  const suffix = NAME_SUFFIXES[fnv1a(`suffix:${file}`) % NAME_SUFFIXES.length];
  const epithet = EPITHETS[fnv1a(`epithet:${file}`) % EPITHETS.length];
  return {
    name: `${prefix}${core}${suffix} ${epithet}`,
    species: speciesFor(file, hash),
  };
}
