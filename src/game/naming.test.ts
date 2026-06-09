import { describe, expect, it } from 'vitest';

import type { DragonSpecies } from '../types.js';
import { dragonName } from './naming.js';

const SPECIES: DragonSpecies[] = [
  'Syntax Wyrm',
  'Null Drake',
  'Race Wyvern',
  'Flaky Hydra',
  'Off-by-One Imp',
  'Regression Behemoth',
  'Legacy Lindworm',
];

describe('the Dragon Registry', () => {
  it('is deterministic — same path, same dragon, every summoning', () => {
    const first = dragonName('src/moat/auth.ts');
    const second = dragonName('src/moat/auth.ts');
    expect(second).toEqual(first);
  });

  it('forges names in the "Name the Epithet" style', () => {
    const { name } = dragonName('src/potions/brew.ts');
    expect(name).toMatch(/^[A-Z][a-z]+ the [A-Z]/);
  });

  it('always returns a species from the bestiary', () => {
    const paths = [
      'src/index.ts',
      'lib/old/parser.js',
      'app/auth/session.ts',
      'src/utils/math.ts',
      'src/config/env.ts',
      'src/cache/retry.ts',
      'weird/Ünïcode/päth.tsx',
    ];
    for (const path of paths) {
      expect(SPECIES).toContain(dragonName(path).species);
    }
  });

  it('flavors species by the file haunt', () => {
    expect(dragonName('vendor/old-thing.js').species).toBe('Legacy Lindworm');
    expect(dragonName('src/api/client.ts').species).toBe('Race Wyvern');
    expect(dragonName('src/utils/sum.ts').species).toBe('Off-by-One Imp');
  });

  it('names diverge across different paths (mostly)', () => {
    const names = new Set<string>();
    for (let i = 0; i < 60; i++) {
      names.add(dragonName(`src/realm/file${i}.ts`).name);
    }
    // Hash collisions in the small name-space are tolerable but should be rare.
    expect(names.size).toBeGreaterThan(45);
  });

  it('keeps epithet collisions rare across a realm of lairs (≤ ~5% of pairs)', () => {
    // The practice-dungeon roster plus 100 synthetic paths in the shapes a
    // real scan produces — sibling files, nested dirs, mixed extensions.
    const paths = [
      'src/dragon-math.ts',
      'src/drawbridge.ts',
      'src/potions.ts',
      'src/quest-ledger.ts',
      'src/moat-auth.ts',
    ];
    const dirs = ['src', 'src/keep', 'app/realm', 'lib/wards', 'src/deep/crypt'];
    const stems = ['auth', 'cache', 'ledger', 'parser', 'tower', 'gate', 'rune', 'ember', 'vault', 'scout'];
    const exts = ['ts', 'tsx'];
    for (let i = 0; i < 100; i++) {
      const dir = dirs[i % dirs.length];
      const stem = stems[i % stems.length];
      const ext = exts[i % exts.length];
      paths.push(`${dir}/${stem}-${i}.${ext}`);
    }

    const epithets = paths.map((p) => {
      const { name } = dragonName(p);
      const at = name.indexOf(' the ');
      expect(at).toBeGreaterThan(0);
      return name.slice(at + 1);
    });

    // Pairwise collision rate: of all distinct pairs of dragons, how many
    // share an epithet? Uniform draws from 48 epithets expect ~2%.
    let collisions = 0;
    let pairs = 0;
    for (let i = 0; i < epithets.length; i++) {
      for (let j = i + 1; j < epithets.length; j++) {
        pairs++;
        if (epithets[i] === epithets[j]) collisions++;
      }
    }
    expect(collisions / pairs).toBeLessThanOrEqual(0.05);

    // And full names should essentially never collide in a set this size.
    const names = new Set(paths.map((p) => dragonName(p).name));
    expect(names.size).toBe(paths.length);
  });
});
