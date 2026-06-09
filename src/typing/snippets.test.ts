import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { incantations, selectSnippets, snippetsFromFile } from './snippets.js';

const LAIR = `import { hoard } from './hoard.js';
import type { Dragon } from '../types.js';

export function breatheFire(target: string): boolean {
  const scorched = target.length > 3 && hoard.has(target);
  return scorched;
}

{
}

export const TREASURE_THRESHOLD = 9000;

function    weirdly   spaced(   line: string  ): string {
  return line;
}
`;

describe('selectSnippets', () => {
  it('is deterministic given identical content', () => {
    const a = selectSnippets(LAIR, '/lair/fire.ts', 3);
    const b = selectSnippets(LAIR, '/lair/fire.ts', 3);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('changes selection when the content changes', () => {
    const lines = Array.from(
      { length: 40 },
      (_, i) => `const ward${i} = enchant(moat, ${i}) + drawbridge(${i});`,
    ).join('\n');
    const a = selectSnippets(lines, '/lair/a.ts', 5).map((s) => s.source);
    const b = selectSnippets(`// a new rune\n${lines}`, '/lair/a.ts', 5).map((s) => s.source);
    expect(a).not.toEqual(b);
  });

  it('skips blanks, imports, and lone braces', () => {
    const all = selectSnippets(LAIR, '/lair/fire.ts', 50);
    for (const s of all) {
      expect(s.text).not.toMatch(/^import\b/);
      expect(s.text).not.toBe('{');
      expect(s.text).not.toBe('}');
      expect(s.text.length).toBeGreaterThan(0);
    }
  });

  it('normalizes whitespace: no leading space, internal runs collapsed', () => {
    const all = selectSnippets(LAIR, '/lair/fire.ts', 50);
    expect(all.length).toBeGreaterThan(0);
    for (const s of all) {
      expect(s.text).not.toMatch(/^\s/);
      expect(s.text).not.toMatch(/\s{2,}/);
      expect(s.text.length).toBeLessThanOrEqual(180);
    }
    const weird = all.find((s) => s.text.includes('weirdly'));
    if (weird) {
      expect(weird.text).toContain('function weirdly spaced( line: string ): string {');
    }
  });

  it('tags snippets as code with file:line sources, sorted by line', () => {
    const all = selectSnippets(LAIR, '/lair/fire.ts', 4);
    const lineNos = all.map((s) => Number(s.source.split(':').pop()));
    for (const s of all) {
      expect(s.kind).toBe('code');
      expect(s.source).toMatch(/^\/lair\/fire\.ts:\d+$/);
    }
    expect(lineNos).toEqual([...lineNos].sort((a, b) => a - b));
  });

  it('respects count and handles barren content', () => {
    expect(selectSnippets(LAIR, '/lair/fire.ts', 2)).toHaveLength(2);
    expect(selectSnippets(LAIR, '/lair/fire.ts', 0)).toEqual([]);
    expect(selectSnippets('\n\n{\n}\n', '/lair/empty.ts', 3)).toEqual([]);
  });
});

describe('snippetsFromFile', () => {
  let dir: string;
  let file: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'gme-scriptorium-'));
    file = join(dir, 'lair.ts');
    await writeFile(file, LAIR, 'utf8');
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads the file and matches the pure selection', async () => {
    const fromFile = await snippetsFromFile(file, 3);
    expect(fromFile).toEqual(selectSnippets(LAIR, file, 3));
  });
});

describe('incantations', () => {
  it('targets the file basename and tags kind incantation', () => {
    const spells = incantations('src/moat/auth.ts', 3);
    expect(spells).toHaveLength(3);
    for (const s of spells) {
      expect(s.kind).toBe('incantation');
      expect(s.source).toBe('incantation');
      expect(s.text).toContain('auth.ts');
    }
    expect(spells[0]!.text).toBe("expect(slay('auth.ts')).toBe(true)");
    expect(spells[1]!.text).toContain("describe('auth.ts'");
  });

  it('is deterministic and cycles when count exceeds the spellbook', () => {
    const a = incantations('castle/keep.ts', 12);
    const b = incantations('castle/keep.ts', 12);
    expect(a).toEqual(b);
    expect(a).toHaveLength(12);
    expect(a[8]!.text).toBe(a[0]!.text); // spellbook has 8 spells
    expect(incantations('castle/keep.ts', 0)).toEqual([]);
  });
});
