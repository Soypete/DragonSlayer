/**
 * The Oracle's Cave — the daily-augury gate, the consult flow, and the
 * inscribe-consent ritual. consultOracle and consultAugury are mocked (no
 * claude CLI); inscribeEdict runs for REAL against a temp-dir repo so the
 * y/n consent is proven on actual scrolls.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { join } from 'node:path';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { Augury, GameConfig, RepoScan, SaveGame } from '../types.js';
import { OracleScreen } from './screens/OracleScreen.js';

const consultOracleMock = vi.hoisted(() => vi.fn());
vi.mock('../ai/oracle.js', () => ({ consultOracle: consultOracleMock }));

const consultAuguryMock = vi.hoisted(() => vi.fn());
vi.mock('../ai/augury.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ai/augury.js')>();
  return { ...actual, consultAugury: consultAuguryMock };
});

const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));

const TODAY = '2026-06-09';

const prophecy = {
  hotspots: [{ file: 'src/moat.ts', reason: '12 uncovered lines' }],
  proclamation: 'The moat gapes unwatched.',
  source: 'fallback' as const,
};

const blessing: Augury = {
  date: TODAY,
  kind: 'blessing',
  edict: 'Prefer table-driven tests named for the behavior they guard.',
  proclamation: 'The cave fills with golden light.',
  snapshot: { coveragePct: 60, testFiles: 4, dragonsSlain: 2 },
  honored: true,
  source: 'fallback',
};

const scan: RepoScan = {
  repoPath: '/realm/keep',
  coverage: null,
  playwright: { configured: false, specCount: 0 },
  ci: { workflows: [], hasTestJob: false },
  sourceFiles: ['src/moat.ts'],
  testFiles: [],
  scannedAt: 2_000,
};

function saveOf(overrides: Partial<SaveGame> = {}): SaveGame {
  return {
    version: 1,
    repoPath: '/realm/keep',
    xp: 0,
    gold: 0,
    rank: 'page',
    dragons: [],
    quests: [],
    stats: { battles: 0, bestWpm: 0, bestAccuracy: 0, totalKeystrokes: 0, dragonsSlain: 2 },
    ...overrides,
  };
}

let caveRepo: string;

beforeEach(() => {
  caveRepo = mkdtempSync(join(tmpdir(), 'gme-cave-'));
  consultOracleMock.mockReset();
  consultOracleMock.mockResolvedValue(prophecy);
  consultAuguryMock.mockReset();
  consultAuguryMock.mockResolvedValue(blessing);
});

afterEach(() => {
  rmSync(caveRepo, { recursive: true, force: true });
});

async function enterCave(save: SaveGame, hasOracleToken = false) {
  const config: GameConfig = {
    repoPath: caveRepo,
    testCommand: 'npm test',
    coverageCommand: 'npm run test:coverage',
    coverageSummaryGlobs: ['coverage/coverage-summary.json'],
    sourceGlobs: ['src/**/*.ts'],
    excludeGlobs: ['**/node_modules/**'],
  };
  const onAugury = vi.fn();
  const onBack = vi.fn();
  const instance = render(
    <OracleScreen
      scan={scan}
      dragons={[]}
      save={save}
      config={config}
      today={TODAY}
      hasOracleToken={hasOracleToken}
      onAugury={onAugury}
      onBack={onBack}
    />,
  );
  await settle();
  return { ...instance, onAugury, onBack };
}

describe("the oracle's cave — act 1, the prophecy", () => {
  it('shows the wait subtitle while the oracle peers into the dark', async () => {
    consultOracleMock.mockReturnValue(new Promise(() => undefined)); // the seer never answers
    const { lastFrame, unmount } = await enterCave(saveOf());
    expect(lastFrame()).toContain('consulting the claude CLI — up to 30s; the cave answers regardless');
    unmount();
  });

  it('still delivers the prophecy as before', async () => {
    const { lastFrame, unmount } = await enterCave(saveOf());
    const frame = lastFrame()!;
    expect(frame).toContain('The moat gapes unwatched.');
    expect(frame).toContain('src/moat.ts');
    expect(frame).toContain('the fallback seer');
    unmount();
  });
});

describe('the daily augury — the calendar gate', () => {
  it('offers the augury when no augury stands', async () => {
    const { lastFrame, unmount } = await enterCave(saveOf());
    expect(lastFrame()).toContain('press a to perform the daily augury');
    unmount();
  });

  it("shows the standing edict and the cave's silence on a same-day revisit", async () => {
    const { stdin, lastFrame, onAugury, unmount } = await enterCave(saveOf({ augury: blessing }));
    const frame = lastFrame()!;
    expect(frame).toContain('the cave is silent until tomorrow');
    expect(frame).toContain(blessing.edict);
    stdin.write('a'); // the gate is shut; nothing should stir
    await settle();
    expect(consultAuguryMock).not.toHaveBeenCalled();
    expect(onAugury).not.toHaveBeenCalled();
    unmount();
  });

  it('consults again on a new day', async () => {
    const yesterday: Augury = { ...blessing, date: '2026-06-08' };
    const { stdin, onAugury, unmount } = await enterCave(saveOf({ augury: yesterday }));
    stdin.write('a');
    await settle();
    expect(consultAuguryMock).toHaveBeenCalledTimes(1);
    expect(consultAuguryMock.mock.calls[0][0]).toEqual(yesterday); // prev augury rides along
    expect(consultAuguryMock.mock.calls[0][2]).toBe(TODAY);
    expect(onAugury).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("the oracle's token forces the gate on a same-day revisit", async () => {
    const { stdin, lastFrame, onAugury, unmount } = await enterCave(saveOf({ augury: blessing }), true);
    expect(lastFrame()).toContain("token burns to be spent");
    stdin.write('a');
    await settle();
    expect(consultAuguryMock).toHaveBeenCalledTimes(1);
    expect(onAugury).toHaveBeenCalledTimes(1);
    unmount();
  });
});

describe('the daily augury — the verdict and the inscribe-consent ritual', () => {
  it('proclaims the kind, edict, and honored verdict, then ASKS before touching the repo', async () => {
    const { stdin, lastFrame, onAugury, unmount } = await enterCave(saveOf());
    stdin.write('a');
    await settle();
    const frame = lastFrame()!;
    expect(frame).toContain('BLESSING');
    expect(frame).toContain('The cave fills with golden light.');
    expect(frame).toContain(blessing.edict);
    expect(frame).toContain("Yesterday's edict was honored");
    expect(frame).toContain('Inscribe the edict into CLAUDE.md/AGENTS.md? (y/n)');
    expect(onAugury).toHaveBeenCalledWith(blessing); // persisted via the Keep before consent
    expect(existsSync(join(caveRepo, 'CLAUDE.md'))).toBe(false); // not yet!
    unmount();
  });

  it('y inscribes the fenced edict into CLAUDE.md and AGENTS.md and lists the paths', async () => {
    const { stdin, lastFrame, unmount } = await enterCave(saveOf());
    stdin.write('a');
    await settle();
    stdin.write('y');
    await settle();
    const frame = lastFrame()!;
    expect(frame).toContain('The edict is law');
    for (const scroll of ['CLAUDE.md', 'AGENTS.md']) {
      const path = join(caveRepo, scroll);
      expect(frame).toContain(path);
      const content = readFileSync(path, 'utf8');
      expect(content).toContain('<!-- gme:oracle-edict:start -->');
      expect(content).toContain(blessing.edict);
      expect(content).toContain('<!-- gme:oracle-edict:end -->');
    }
    unmount();
  });

  it('n keeps the edict in-game only — the repo scrolls stay untouched', async () => {
    const { stdin, lastFrame, unmount } = await enterCave(saveOf());
    stdin.write('a');
    await settle();
    stdin.write('n');
    await settle();
    expect(lastFrame()).toContain("the repo's scrolls are untouched");
    expect(existsSync(join(caveRepo, 'CLAUDE.md'))).toBe(false);
    expect(existsSync(join(caveRepo, 'AGENTS.md'))).toBe(false);
    unmount();
  });

  it('shows the unhonored reckoning when yesterday went ill', async () => {
    consultAuguryMock.mockResolvedValue({ ...blessing, kind: 'curse', honored: false });
    const { stdin, lastFrame, unmount } = await enterCave(saveOf());
    stdin.write('a');
    await settle();
    const frame = lastFrame()!;
    expect(frame).toContain('CURSE');
    expect(frame).toContain("went unhonored; the cave remembers");
    unmount();
  });
});
