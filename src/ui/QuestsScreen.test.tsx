/**
 * The Guild Board — pledging is free, the sigil marks the sworn, and F buys
 * the squire's forging for 25 gold (refunded when his hammer stays).
 * forgeSkill is mocked: no claude CLI and no repo writes in these halls.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import type { GameConfig, Quest, RepoScan, SaveGame } from '../types.js';
import { QuestsScreen } from './screens/QuestsScreen.js';

const forgeSkillMock = vi.hoisted(() => vi.fn());
vi.mock('../ai/squire.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ai/squire.js')>();
  return { ...actual, forgeSkill: forgeSkillMock };
});

const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));

function metric(total: number, covered: number) {
  return { total, covered, pct: total === 0 ? 100 : (covered / total) * 100 };
}

const scan: RepoScan = {
  repoPath: '/realm/keep',
  coverage: {
    files: [],
    totals: {
      lines: metric(100, 50),
      statements: metric(100, 50),
      functions: metric(10, 5),
      branches: metric(10, 5),
    },
    source: 'coverage/coverage-summary.json',
    generatedAt: 1_000,
  },
  playwright: { configured: false, specCount: 0 },
  ci: { workflows: [], hasTestJob: false },
  sourceFiles: ['src/moat.ts'],
  testFiles: [],
  scannedAt: 2_000,
};

const config: GameConfig = {
  repoPath: '/realm/keep',
  testCommand: 'npm test',
  coverageCommand: 'npm run test:coverage',
  coverageSummaryGlobs: ['coverage/coverage-summary.json'],
  sourceGlobs: ['src/**/*.ts'],
  excludeGlobs: ['**/node_modules/**'],
};

const slayQuest: Quest = {
  id: 'slay:src/moat.ts',
  kind: 'slay',
  title: 'Slay Vexmaw of the Moat',
  description: 'Cover every line of src/moat.ts.',
  objectives: [{ id: 'slay:obj', description: 'reach 100% lines', done: false }],
  xpReward: 100,
  status: 'available',
  target: 'src/moat.ts',
};

const coverageQuest: Quest = {
  id: 'coverage:75',
  kind: 'coverage',
  title: 'Three Quarters Warded',
  description: 'Raise total line coverage to 75%.',
  objectives: [{ id: 'cov:obj', description: 'lines ≥ 75%', done: false }],
  xpReward: 150,
  status: 'available',
};

function saveOf(overrides: Partial<SaveGame> = {}): SaveGame {
  return {
    version: 1,
    repoPath: '/realm/keep',
    xp: 0,
    gold: 0,
    rank: 'page',
    dragons: [],
    quests: [slayQuest, coverageQuest],
    stats: { battles: 0, bestWpm: 0, bestAccuracy: 0, totalKeystrokes: 0, dragonsSlain: 0 },
    ...overrides,
  };
}

async function bootBoard(save: SaveGame) {
  const onPledge = vi.fn();
  const onChronicle = vi.fn();
  const onBack = vi.fn();
  const instance = render(
    <QuestsScreen
      save={save}
      scan={scan}
      config={config}
      onPledge={onPledge}
      onChronicle={onChronicle}
      onBack={onBack}
    />,
  );
  await settle();
  return { ...instance, onPledge, onChronicle, onBack };
}

beforeEach(() => {
  forgeSkillMock.mockReset();
});

describe('the guild board — pledging', () => {
  it('hangs the explanatory banner over the board', async () => {
    const { lastFrame, unmount } = await bootBoard(saveOf());
    expect(lastFrame()).toContain(
      'quests track themselves — objectives update when you forge; enter pledges',
    );
    unmount();
  });

  it('pledges the chosen quest with enter — for free', async () => {
    const { stdin, onPledge, onChronicle, unmount } = await bootBoard(saveOf());
    stdin.write('\r');
    await settle();
    expect(onPledge).toHaveBeenCalledTimes(1);
    expect((onPledge.mock.calls[0][0] as Quest).id).toBe(slayQuest.id);
    expect(onChronicle).not.toHaveBeenCalled(); // no gold changes hands
    unmount();
  });

  it('roams with j/k and pledges the quest under the cursor', async () => {
    const { stdin, onPledge, unmount } = await bootBoard(saveOf());
    stdin.write('j');
    await settle();
    stdin.write('\r');
    await settle();
    expect((onPledge.mock.calls[0][0] as Quest).id).toBe(coverageQuest.id);
    unmount();
  });

  it('marks pledged quests with the sigil and floats them first', async () => {
    const { lastFrame, unmount } = await bootBoard(saveOf({ pledges: [coverageQuest.id] }));
    const frame = lastFrame()!;
    expect(frame).toContain('⚑');
    expect(frame).toContain('sworn');
    expect(frame.indexOf('Three Quarters Warded')).toBeLessThan(
      frame.indexOf('Slay Vexmaw of the Moat'),
    );
    unmount();
  });

  it('offers the forging only on a pledged quest', async () => {
    const sworn = await bootBoard(saveOf({ pledges: [slayQuest.id], gold: 100 }));
    expect(sworn.lastFrame()).toContain('Forge a Claude skill — 25 gold');
    sworn.unmount();
    const unsworn = await bootBoard(saveOf({ gold: 100 }));
    expect(unsworn.lastFrame()).not.toContain('Forge a Claude skill — 25 gold');
    unsworn.unmount();
  });
});

describe('the guild board — F buys a forging', () => {
  it('debits 25 gold and shows the forged scroll on success', async () => {
    forgeSkillMock.mockResolvedValue({
      path: '/realm/keep/.claude/skills/gme-slay-moat/SKILL.md',
      source: 'fallback',
    });
    const { stdin, lastFrame, onChronicle, unmount } = await bootBoard(
      saveOf({ pledges: [slayQuest.id], gold: 40 }),
    );
    stdin.write('F');
    await settle();
    expect(onChronicle).toHaveBeenCalledTimes(1);
    expect((onChronicle.mock.calls[0][0] as SaveGame).gold).toBe(15);
    expect(forgeSkillMock).toHaveBeenCalledTimes(1);
    const frame = lastFrame()!;
    expect(frame).toContain('The skill is forged');
    expect(frame).toContain('/realm/keep/.claude/skills/gme-slay-moat/SKILL.md');
    expect(frame).toContain('deterministic template');
    unmount();
  });

  it('refunds the gold and breaks the news kindly when the forge throws', async () => {
    forgeSkillMock.mockRejectedValue(
      new Error('The squire stays his hammer: a foreign scroll blocks the path.'),
    );
    const { stdin, lastFrame, onChronicle, unmount } = await bootBoard(
      saveOf({ pledges: [slayQuest.id], gold: 40 }),
    );
    stdin.write('F');
    await settle();
    expect(onChronicle).toHaveBeenCalledTimes(2);
    expect((onChronicle.mock.calls[0][0] as SaveGame).gold).toBe(15); // debit…
    expect((onChronicle.mock.calls[1][0] as SaveGame).gold).toBe(40); // …refunded
    const frame = lastFrame()!;
    expect(frame).toContain('a foreign scroll blocks the path');
    expect(frame).toContain('refunded');
    unmount();
  });

  it('extends no credit when the purse is short', async () => {
    const { stdin, lastFrame, onChronicle, unmount } = await bootBoard(
      saveOf({ pledges: [slayQuest.id], gold: 10 }),
    );
    stdin.write('F');
    await settle();
    expect(onChronicle).not.toHaveBeenCalled();
    expect(forgeSkillMock).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('the guild extends no credit');
    unmount();
  });

  it('counsels pledging first when F lands on an unsworn deed', async () => {
    const { stdin, lastFrame, unmount } = await bootBoard(saveOf({ gold: 100 }));
    stdin.write('F');
    await settle();
    expect(lastFrame()).toContain('pledge it first');
    expect(forgeSkillMock).not.toHaveBeenCalled();
    unmount();
  });
});
