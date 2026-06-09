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
});
