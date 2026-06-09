/**
 * The Guild Shop — gold math at the counter, the no-credit policy, the
 * oracle's token, the whetstone, and the forge-skill purchase (forgeSkill
 * mocked: no claude CLI, no repo writes).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import type { GameConfig, Quest, RepoScan, SaveGame } from '../types.js';
import { ShopScreen } from './screens/ShopScreen.js';

const forgeSkillMock = vi.hoisted(() => vi.fn());
vi.mock('../ai/squire.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ai/squire.js')>();
  return { ...actual, forgeSkill: forgeSkillMock };
});

const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));

const scan: RepoScan = {
  repoPath: '/realm/keep',
  coverage: null,
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

function questOf(id: string, title: string): Quest {
  return {
    id,
    kind: 'slay',
    title,
    description: 'a sworn deed',
    objectives: [],
    xpReward: 100,
    status: 'available',
    target: 'src/moat.ts',
  };
}

function saveOf(overrides: Partial<SaveGame> = {}): SaveGame {
  return {
    version: 1,
    repoPath: '/realm/keep',
    xp: 0,
    gold: 0,
    rank: 'page',
    dragons: [],
    quests: [],
    stats: { battles: 0, bestWpm: 0, bestAccuracy: 0, totalKeystrokes: 0, dragonsSlain: 0 },
    ...overrides,
  };
}

async function bootShop(save: SaveGame, hasOracleToken = false) {
  const onOracleToken = vi.fn();
  const onChronicle = vi.fn();
  const onBack = vi.fn();
  const instance = render(
    <ShopScreen
      save={save}
      scan={scan}
      config={config}
      hasOracleToken={hasOracleToken}
      onOracleToken={onOracleToken}
      onChronicle={onChronicle}
      onBack={onBack}
    />,
  );
  await settle();
  return { ...instance, onOracleToken, onChronicle, onBack };
}

beforeEach(() => {
  forgeSkillMock.mockReset();
});

describe('the guild shop — the shelf and the no-credit policy', () => {
  it('shows all three wares with their prices and the purse', async () => {
    const { lastFrame, unmount } = await bootShop(saveOf({ gold: 100 }));
    const frame = lastFrame()!;
    expect(frame).toContain('The Guild Shop');
    expect(frame).toContain('⛁ 100 gold');
    expect(frame).toContain('Forge a Claude skill — 25 gold');
    expect(frame).toContain("Oracle's token — 50 gold");
    expect(frame).toContain('Sharpening stone — 30 gold');
    unmount();
  });

  it('grays every ware behind the counter when the purse is empty', async () => {
    const { lastFrame, unmount } = await bootShop(saveOf({ gold: 0 }));
    const matches = lastFrame()!.match(/the guild extends no credit/g) ?? [];
    expect(matches.length).toBe(3);
    unmount();
  });

  it('refuses the sale outright on enter when gold is short', async () => {
    const { stdin, lastFrame, onChronicle, unmount } = await bootShop(saveOf({ gold: 5 }));
    stdin.write('j'); // oracle-token
    await settle();
    stdin.write('\r');
    await settle();
    expect(onChronicle).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('the guild extends no credit — 50 gold');
    unmount();
  });

  it('leaves the shop with esc', async () => {
    const { stdin, onBack, unmount } = await bootShop(saveOf());
    stdin.write('');
    await settle();
    expect(onBack).toHaveBeenCalled();
    unmount();
  });
});

describe("the oracle's token — 50 gold for one more augury", () => {
  it('debits 50 gold and hands over the token', async () => {
    const { stdin, lastFrame, onChronicle, onOracleToken, unmount } = await bootShop(
      saveOf({ gold: 60 }),
    );
    stdin.write('j');
    await settle();
    stdin.write('\r');
    await settle();
    expect(onOracleToken).toHaveBeenCalledTimes(1);
    expect((onChronicle.mock.calls[0][0] as SaveGame).gold).toBe(10);
    expect(lastFrame()).toContain('the cave will speak once more today');
    unmount();
  });

  it('sells no second token while one is carried', async () => {
    const { stdin, lastFrame, onChronicle, unmount } = await bootShop(saveOf({ gold: 100 }), true);
    expect(lastFrame()).toContain("you already carry the oracle's token");
    stdin.write('j');
    await settle();
    stdin.write('\r');
    await settle();
    expect(onChronicle).not.toHaveBeenCalled();
    unmount();
  });
});

describe('the sharpening stone — 30 gold, ×1.2 next battle', () => {
  it('debits 30 gold and hones the blade to ×1.2', async () => {
    const { stdin, onChronicle, lastFrame, unmount } = await bootShop(saveOf({ gold: 30 }));
    stdin.write('j');
    await settle();
    stdin.write('j'); // sharpening-stone
    await settle();
    stdin.write('\r');
    await settle();
    const next = onChronicle.mock.calls[0][0] as SaveGame;
    expect(next.gold).toBe(0);
    expect(next.vim?.bladeBuff).toBe(1.2);
    expect(lastFrame()).toContain('×1.2 for the next battle');
    unmount();
  });

  it('declines to grind an already-keen edge', async () => {
    const keen = saveOf({ gold: 100, vim: { results: {}, unlockedTier: 1, bladeBuff: 1.5 } });
    const { lastFrame, unmount } = await bootShop(keen);
    expect(lastFrame()).toContain('your edge is already keen (×1.5)');
    unmount();
  });
});

describe('the forge-skill ware — 25 gold for a sworn deed', () => {
  it('demands a pledged, incomplete quest before it sells', async () => {
    const { stdin, lastFrame, onChronicle, unmount } = await bootShop(saveOf({ gold: 100 }));
    stdin.write('\r');
    await settle();
    expect(lastFrame()).toContain('pledge a quest on the guild board first');
    expect(onChronicle).not.toHaveBeenCalled();
    unmount();
  });

  it('forges straight away when exactly one deed is sworn', async () => {
    forgeSkillMock.mockResolvedValue({
      path: '/realm/keep/.claude/skills/gme-slay-moat/SKILL.md',
      source: 'claude',
    });
    const sworn = saveOf({
      gold: 30,
      quests: [questOf('slay:src/moat.ts', 'Slay Vexmaw of the Moat')],
      pledges: ['slay:src/moat.ts'],
    });
    const { stdin, lastFrame, onChronicle, unmount } = await bootShop(sworn);
    stdin.write('\r');
    await settle();
    expect((onChronicle.mock.calls[0][0] as SaveGame).gold).toBe(5);
    expect(forgeSkillMock).toHaveBeenCalledTimes(1);
    const frame = lastFrame()!;
    expect(frame).toContain('The skill is forged');
    expect(frame).toContain('the true seer');
    unmount();
  });

  it('offers the quest picker when several deeds are sworn, then forges the chosen one', async () => {
    forgeSkillMock.mockResolvedValue({
      path: '/realm/keep/.claude/skills/gme-coverage-75/SKILL.md',
      source: 'fallback',
    });
    const sworn = saveOf({
      gold: 50,
      quests: [
        questOf('slay:src/moat.ts', 'Slay Vexmaw of the Moat'),
        questOf('coverage:75', 'Three Quarters Warded'),
      ],
      pledges: ['slay:src/moat.ts', 'coverage:75'],
    });
    const { stdin, lastFrame, onChronicle, unmount } = await bootShop(sworn);
    stdin.write('\r');
    await settle();
    expect(lastFrame()).toContain('Which sworn deed');
    stdin.write('j'); // choose the second pledge
    await settle();
    stdin.write('\r');
    await settle();
    expect((onChronicle.mock.calls[0][0] as SaveGame).gold).toBe(25);
    expect((forgeSkillMock.mock.calls[0][0] as Quest).id).toBe('coverage:75');
    expect(lastFrame()).toContain('gme-coverage-75');
    unmount();
  });

  it('refunds the 25 gold when the squire stays his hammer', async () => {
    forgeSkillMock.mockRejectedValue(new Error('a foreign scroll blocks the path'));
    const sworn = saveOf({
      gold: 30,
      quests: [questOf('slay:src/moat.ts', 'Slay Vexmaw of the Moat')],
      pledges: ['slay:src/moat.ts'],
    });
    const { stdin, lastFrame, onChronicle, unmount } = await bootShop(sworn);
    stdin.write('\r');
    await settle();
    expect(onChronicle).toHaveBeenCalledTimes(2);
    expect((onChronicle.mock.calls[0][0] as SaveGame).gold).toBe(5);
    expect((onChronicle.mock.calls[1][0] as SaveGame).gold).toBe(30);
    expect(lastFrame()).toContain('refunded');
    unmount();
  });
});
