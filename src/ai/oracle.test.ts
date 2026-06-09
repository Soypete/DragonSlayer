/**
 * Trials of the Oracle — tests for the pure prophecy logic only.
 * The real `claude` CLI is never summoned here; we test the elder's
 * fallback heuristic and the entrail-reading (JSON extraction) helper.
 */

import { describe, expect, it } from 'vitest';
import type { Dragon, RepoScan } from '../types.js';
import { extractProphecyJson, fallbackProphecy } from './oracle.js';

// ── Fixture forging ──────────────────────────────────────────────────────────

function forgeDragon(overrides: Partial<Dragon> & { file: string }): Dragon {
  return {
    id: overrides.file,
    name: 'Vexmaw the Untested',
    species: 'Null Drake',
    maxHp: 50,
    hp: 50,
    weakened: 0,
    slain: false,
    coveragePct: 0,
    ...overrides,
  };
}

function forgeScan(overrides: Partial<RepoScan> = {}): RepoScan {
  return {
    repoPath: '/kingdom/keep',
    coverage: null,
    playwright: { configured: false, specCount: 0 },
    ci: { workflows: [], hasTestJob: false },
    sourceFiles: [],
    testFiles: [],
    scannedAt: 0,
    ...overrides,
  };
}

// ── The elder's fallback prophecy ────────────────────────────────────────────

describe('fallbackProphecy — the village elder speaks', () => {
  it('ranks living dragons by hp descending', () => {
    const dragons = [
      forgeDragon({ file: 'src/moat.ts', hp: 12 }),
      forgeDragon({ file: 'src/drawbridge.ts', hp: 97 }),
      forgeDragon({ file: 'src/potion.ts', hp: 40 }),
    ];
    const prophecy = fallbackProphecy(forgeScan(), dragons);
    expect(prophecy.hotspots.map((h) => h.file)).toEqual([
      'src/drawbridge.ts',
      'src/potion.ts',
      'src/moat.ts',
    ]);
    expect(prophecy.source).toBe('fallback');
  });

  it('breaks hp ties by file path so the omen never wavers', () => {
    const dragons = [
      forgeDragon({ file: 'src/zeppelin.ts', hp: 30 }),
      forgeDragon({ file: 'src/abbey.ts', hp: 30 }),
    ];
    const prophecy = fallbackProphecy(forgeScan(), dragons);
    expect(prophecy.hotspots.map((h) => h.file)).toEqual(['src/abbey.ts', 'src/zeppelin.ts']);
  });

  it('is deterministic across tellings', () => {
    const dragons = [
      forgeDragon({ file: 'src/moat.ts', hp: 12 }),
      forgeDragon({ file: 'src/drawbridge.ts', hp: 97 }),
    ];
    const scan = forgeScan({ testFiles: ['tests/moat.test.ts'] });
    expect(fallbackProphecy(scan, dragons)).toEqual(fallbackProphecy(scan, dragons));
  });

  it('omits slain and zero-hp dragons from the omen', () => {
    const dragons = [
      forgeDragon({ file: 'src/slain.ts', hp: 80, slain: true }),
      forgeDragon({ file: 'src/spent.ts', hp: 0 }),
      forgeDragon({ file: 'src/alive.ts', hp: 5 }),
    ];
    const prophecy = fallbackProphecy(forgeScan(), dragons);
    expect(prophecy.hotspots.map((h) => h.file)).toEqual(['src/alive.ts']);
  });

  it('names at most five hotspots', () => {
    const dragons = Array.from({ length: 9 }, (_, i) =>
      forgeDragon({ file: `src/lair-${i}.ts`, hp: 100 - i }),
    );
    const prophecy = fallbackProphecy(forgeScan(), dragons);
    expect(prophecy.hotspots).toHaveLength(5);
    expect(prophecy.hotspots[0].file).toBe('src/lair-0.ts');
  });

  it('laments untested files no test file names', () => {
    const dragons = [forgeDragon({ file: 'src/drawbridge.ts', hp: 97 })];
    const prophecy = fallbackProphecy(forgeScan({ testFiles: ['tests/moat.test.ts'] }), dragons);
    expect(prophecy.hotspots[0].reason).toContain('97 uncovered lines');
    expect(prophecy.hotspots[0].reason).toContain('no test file names it');
  });

  it('notes partial coverage when a ward names the file', () => {
    const dragons = [forgeDragon({ file: 'src/moat.ts', hp: 8, coveragePct: 62 })];
    const scan = forgeScan({ testFiles: ['tests/moat.test.ts'] });
    const prophecy = fallbackProphecy(scan, dragons);
    expect(prophecy.hotspots[0].reason).toContain('62%');
  });

  it('uses singular grammar for a single uncovered line', () => {
    const dragons = [forgeDragon({ file: 'src/moat.ts', hp: 1 })];
    const prophecy = fallbackProphecy(forgeScan(), dragons);
    expect(prophecy.hotspots[0].reason).toContain('1 uncovered line ');
  });

  it('proclaims the greatest menace by name and lair', () => {
    const dragons = [
      forgeDragon({ file: 'src/drawbridge.ts', hp: 97, name: 'Gorthax', species: 'Legacy Lindworm' }),
    ];
    const prophecy = fallbackProphecy(forgeScan(), dragons);
    expect(prophecy.proclamation).toContain('Gorthax');
    expect(prophecy.proclamation).toContain('src/drawbridge.ts');
    expect(prophecy.proclamation).toContain('97');
  });

  it('proclaims peace when no dragons live', () => {
    const prophecy = fallbackProphecy(forgeScan(), []);
    expect(prophecy.hotspots).toEqual([]);
    expect(prophecy.proclamation).toContain('The realm rests');
    expect(prophecy.source).toBe('fallback');
  });
});

// ── Reading the entrails (JSON extraction) ───────────────────────────────────

describe('extractProphecyJson — divining JSON from the utterance', () => {
  const trueOmen = {
    hotspots: [{ file: 'src/moat.ts', reason: 'the moat is dry' }],
    proclamation: 'Beware the moat.',
  };

  it('reads a bare JSON utterance', () => {
    expect(extractProphecyJson(JSON.stringify(trueOmen))).toEqual(trueOmen);
  });

  it('tolerates surrounding whitespace', () => {
    expect(extractProphecyJson(`\n\n  ${JSON.stringify(trueOmen)}  \n`)).toEqual(trueOmen);
  });

  it('reads a prophecy fenced in ```json', () => {
    const utterance = 'Hark!\n```json\n' + JSON.stringify(trueOmen) + '\n```\nSo it is written.';
    expect(extractProphecyJson(utterance)).toEqual(trueOmen);
  });

  it('reads a prophecy fenced without a language tag', () => {
    const utterance = '```\n' + JSON.stringify(trueOmen) + '\n```';
    expect(extractProphecyJson(utterance)).toEqual(trueOmen);
  });

  it('digs braces out of surrounding prose', () => {
    const utterance = 'The oracle hums: ' + JSON.stringify(trueOmen) + ' and falls silent.';
    expect(extractProphecyJson(utterance)).toEqual(trueOmen);
  });

  it('truncates the hotspot list to five', () => {
    const swollen = {
      hotspots: Array.from({ length: 8 }, (_, i) => ({ file: `f${i}.ts`, reason: 'doom' })),
      proclamation: 'Many dooms.',
    };
    const omen = extractProphecyJson(JSON.stringify(swollen));
    expect(omen?.hotspots).toHaveLength(5);
  });

  it('accepts an empty hotspot list when the proclamation stands', () => {
    const omen = extractProphecyJson(JSON.stringify({ hotspots: [], proclamation: 'Peace.' }));
    expect(omen).toEqual({ hotspots: [], proclamation: 'Peace.' });
  });

  it('rejects gibberish', () => {
    expect(extractProphecyJson('the dragon ate my JSON')).toBeNull();
  });

  it('rejects an empty utterance', () => {
    expect(extractProphecyJson('')).toBeNull();
    expect(extractProphecyJson('   \n  ')).toBeNull();
  });

  it('rejects JSON missing the proclamation', () => {
    expect(extractProphecyJson(JSON.stringify({ hotspots: [] }))).toBeNull();
  });

  it('rejects JSON whose hotspots are malformed', () => {
    expect(
      extractProphecyJson(
        JSON.stringify({ hotspots: [{ file: 42, reason: 'nope' }], proclamation: 'Hm.' }),
      ),
    ).toBeNull();
    expect(
      extractProphecyJson(JSON.stringify({ hotspots: 'not-a-list', proclamation: 'Hm.' })),
    ).toBeNull();
  });

  it('rejects non-object JSON values', () => {
    expect(extractProphecyJson('"just a string"')).toBeNull();
    expect(extractProphecyJson('[1, 2, 3]')).toBeNull();
    expect(extractProphecyJson('null')).toBeNull();
  });

  it('rejects a blank proclamation', () => {
    expect(
      extractProphecyJson(JSON.stringify({ hotspots: [], proclamation: '   ' })),
    ).toBeNull();
  });
});
