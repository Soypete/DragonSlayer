/**
 * Integration ride-through: boot the Keep with a practice-dungeon-shaped
 * fixture and walk Title → Map → Quests → Battle with simulated keystrokes.
 * No commands are run and no save is written on these paths.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { Dragon, GameConfig, Quest, RepoScan, SaveGame } from '../types.js';
import { loadSave } from '../game/state.js';
import { newVimProgress } from '../vim/trials.js';
import { App } from './App.js';

const REPO = join(process.cwd(), 'practice-dungeon');

function metric(total: number, covered: number) {
  return { total, covered, pct: total === 0 ? 100 : (covered / total) * 100 };
}

const scan: RepoScan = {
  repoPath: REPO,
  coverage: {
    files: [],
    totals: {
      lines: metric(154, 73),
      statements: metric(154, 73),
      functions: metric(20, 9),
      branches: metric(30, 14),
    },
    source: 'coverage/coverage-summary.json',
    generatedAt: 1_000,
  },
  playwright: { configured: false, specCount: 0 },
  ci: { workflows: [], hasTestJob: false },
  sourceFiles: ['src/dragon-math.ts', 'src/moat-auth.ts'],
  testFiles: ['tests/potions.test.ts'],
  scannedAt: 2_000,
};

const dragons: Dragon[] = [
  {
    id: 'src/dragon-math.ts',
    file: 'src/dragon-math.ts',
    name: 'Vexmaw the Untested',
    species: 'Off-by-One Imp',
    maxHp: 24,
    hp: 24,
    weakened: 0,
    slain: false,
    coveragePct: 0,
  },
];

const quests: Quest[] = [
  {
    id: 'slay:src/dragon-math.ts',
    kind: 'slay',
    title: 'Slay Vexmaw the Untested',
    description: 'Cover every line of src/dragon-math.ts.',
    objectives: [{ id: 'slay:obj', description: 'reach 100% lines', done: false }],
    xpReward: 100,
    status: 'available',
    target: 'src/dragon-math.ts',
  },
];

const save: SaveGame = {
  version: 1,
  repoPath: REPO,
  xp: 0,
  gold: 0,
  rank: 'page',
  dragons,
  quests,
  stats: { battles: 0, bestWpm: 0, bestAccuracy: 0, totalKeystrokes: 0, dragonsSlain: 0 },
  lastScan: { coveragePct: 47.4, timestamp: 1_000 },
};

const config: GameConfig = {
  repoPath: REPO,
  testCommand: 'npm test',
  coverageCommand: 'npm run test:coverage',
  coverageSummaryGlobs: ['coverage/coverage-summary.json'],
  sourceGlobs: ['src/**/*.ts'],
  excludeGlobs: ['**/node_modules/**'],
};

const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));

/**
 * Render the Keep and wait one beat: Ink attaches its stdin listener in a
 * passive effect, so a keystroke written synchronously after render is lost.
 */
async function bootApp() {
  const instance = render(
    <App config={config} initialScan={scan} initialSave={save} hadChronicle={true} />,
  );
  await settle();
  return instance;
}

describe('the Keep — screen state machine', () => {
  it('opens at the castle gates with the chronicle teased', async () => {
    const { lastFrame, unmount } = await bootApp();
    expect(lastFrame()).toContain('Continue the campaign');
    expect(lastFrame()).toContain('Page of the Untested Marches');
    unmount();
  });

  it('rides forth to the realm map and shows the dragon roster', async () => {
    const { lastFrame, stdin, unmount } = await bootApp();
    stdin.write('\r');
    await settle();
    const frame = lastFrame()!;
    expect(frame).toContain('Vexmaw the Untested');
    expect(frame).toContain('src/dragon-math.ts');
    expect(frame).toContain('24/24');
    expect(frame).toContain('Realm coverage');
    expect(frame).toContain('forge');
    unmount();
  });

  it('opens the guild board with q and returns with esc', async () => {
    const { lastFrame, stdin, unmount } = await bootApp();
    stdin.write('\r');
    await settle();
    stdin.write('q');
    await settle();
    expect(lastFrame()).toContain('The Guild Board');
    expect(lastFrame()).toContain('Slay Vexmaw the Untested');
    stdin.write(''); // esc
    await settle();
    expect(lastFrame()).toContain('Realm coverage');
    unmount();
  });

  it('engages a dragon and unfurls five scrolls from its real lair', async () => {
    const { lastFrame, stdin, unmount } = await bootApp();
    stdin.write('\r');
    await settle();
    stdin.write('\r'); // engage the selected dragon
    await settle(150); // snippetsFromFile reads the real practice-dungeon file
    const frame = lastFrame()!;
    expect(frame).toContain('Scroll 1 of 5');
    expect(frame).toContain('Vexmaw the Untested');
    expect(frame).toContain('flee');
    unmount();
  });

  it('flees a battle back to the realm map with esc', async () => {
    const { lastFrame, stdin, unmount } = await bootApp();
    stdin.write('\r');
    await settle();
    stdin.write('\r');
    await settle(150);
    stdin.write('');
    await settle();
    expect(lastFrame()).toContain('Realm coverage');
    unmount();
  });
});

// ── The realm map rides like vim ─────────────────────────────────────────────

const ESC = '';

const secondDragon: Dragon = {
  id: 'src/moat-auth.ts',
  file: 'src/moat-auth.ts',
  name: 'Sallowfang the Porous',
  species: 'Null Drake',
  maxHp: 12,
  hp: 12,
  weakened: 0,
  slain: false,
  coveragePct: 0,
};

async function bootRealm(realmSave: SaveGame) {
  const instance = render(
    <App config={config} initialScan={scan} initialSave={realmSave} hadChronicle={true} />,
  );
  await settle();
  instance.stdin.write('\r'); // ride forth to the map
  await settle();
  return instance;
}

describe('the realm map — vim navigation and the sword-school gate', () => {
  const twoLairs: SaveGame = { ...save, dragons: [...dragons, secondDragon] };

  it('roams the roster with j and k', async () => {
    const { lastFrame, stdin, unmount } = await bootRealm(twoLairs);
    expect(lastFrame()).toContain('❯ ± Vexmaw the Untested');
    stdin.write('j');
    await settle();
    expect(lastFrame()).toContain('❯ ø Sallowfang the Porous');
    stdin.write('k');
    await settle();
    expect(lastFrame()).toContain('❯ ± Vexmaw the Untested');
    unmount();
  });

  it('leaps to the last lair with G and back to the first with gg', async () => {
    const { lastFrame, stdin, unmount } = await bootRealm(twoLairs);
    stdin.write('G');
    await settle();
    expect(lastFrame()).toContain('❯ ø Sallowfang the Porous');
    stdin.write('g');
    await settle();
    stdin.write('g');
    await settle();
    expect(lastFrame()).toContain('❯ ± Vexmaw the Untested');
    unmount();
  });

  it('surfaces the sword-school in the footer and opens it with v', async () => {
    const { lastFrame, stdin, unmount } = await bootRealm(save);
    expect(lastFrame()).toContain('sword-school');
    stdin.write('v');
    await settle();
    expect(lastFrame()).toContain('The Sword-School');
    expect(lastFrame()).toContain('Eastward, Squire');
    stdin.write(ESC);
    await settle();
    expect(lastFrame()).toContain('Realm coverage');
    unmount();
  });
});

// ── The sharpened blade rides into battle ────────────────────────────────────

describe('the battle — sharpened blade buff', () => {
  it('shows the blade multiplier over the wound-gauge when buffed', async () => {
    const buffed: SaveGame = { ...save, vim: { ...newVimProgress(), bladeBuff: 1.2 } };
    const { lastFrame, stdin, unmount } = await bootRealm(buffed);
    stdin.write('\r'); // engage
    await settle(150);
    expect(lastFrame()).toContain('⚔ sharpened blade ×1.2');
    unmount();
  });

  it('keeps an unsharpened battle free of blade talk', async () => {
    const { lastFrame, stdin, unmount } = await bootRealm(save);
    stdin.write('\r');
    await settle(150);
    expect(lastFrame()).not.toContain('sharpened blade');
    unmount();
  });
});

// ── A full trial, chronicled to disk ─────────────────────────────────────────

describe('the Keep — a sword-school trial persists to the chronicle', () => {
  let vault: string;
  let priorHome: string | undefined;

  beforeEach(() => {
    vault = mkdtempSync(join(tmpdir(), 'gme-vault-'));
    priorHome = process.env.HOME;
    process.env.HOME = vault; // os.homedir() honors $HOME on POSIX
  });

  afterEach(() => {
    if (priorHome === undefined) delete process.env.HOME;
    else process.env.HOME = priorHome;
    rmSync(vault, { recursive: true, force: true });
  });

  it('walks lesson → practice → scored → debrief and writes the save', async () => {
    const { lastFrame, stdin, unmount } = await bootRealm(save);
    stdin.write('v');
    await settle();
    stdin.write('\r'); // take Eastward, Squire
    await settle();
    expect(lastFrame()).toContain('l walks right, h walks left');
    stdin.write('\r'); // practice rep
    await settle();
    stdin.write('lll');
    await settle();
    expect(lastFrame()).toContain('✓ The goal is met!');
    stdin.write('\r'); // scored attempt
    await settle();
    stdin.write('lll');
    await settle();
    expect(lastFrame()).toContain('★★★');
    expect(lastFrame()).toContain('XP +30');

    const chronicle = loadSave(REPO);
    expect(chronicle?.xp).toBe(30);
    expect(chronicle?.vim?.results['t1-eastward-squire']?.stars).toBe(3);
    expect(chronicle?.vim?.bladeBuff).toBe(1.5);
    unmount();
  });
});
