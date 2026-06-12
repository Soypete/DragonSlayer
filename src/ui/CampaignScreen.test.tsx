/**
 * The Hall of Banners under test: listing campaigns, riding into one,
 * refusing vanished realms, and charting a new realm by typed path.
 */

import { describe, expect, it } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { resolve } from 'node:path';
import type { CampaignEntry, SaveGame } from '../types.js';
import { newSave } from '../game/state.js';
import { CampaignScreen } from './screens/CampaignScreen.js';

const DOWN = '[B';

const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));

function chronicled(repoPath: string): SaveGame {
  return {
    ...newSave(repoPath),
    xp: 800,
    gold: 120,
    stats: { battles: 3, bestWpm: 70, bestAccuracy: 0.97, totalKeystrokes: 900, dragonsSlain: 2 },
    lastScan: { coveragePct: 61.5, timestamp: 5 },
  };
}

const entry = (repoPath: string, overrides: Partial<CampaignEntry> = {}): CampaignEntry => ({
  repoPath,
  save: chronicled(repoPath),
  exists: true,
  ...overrides,
});

interface Hooks {
  chosen: string[];
  charted: string[];
}

async function openHall(
  entries: CampaignEntry[],
  opts: { exists?: (p: string) => boolean; suggested?: string } = {},
) {
  const hooks: Hooks = { chosen: [], charted: [] };
  const instance = render(
    <CampaignScreen
      entries={entries}
      suggestedRepo={opts.suggested ?? '/realm/suggested'}
      onChoose={(p) => hooks.chosen.push(p)}
      onChart={(p) => hooks.charted.push(p)}
      exists={opts.exists ?? (() => true)}
      cwd="/realm"
    />,
  );
  await settle();
  return { ...instance, hooks };
}

describe('the Hall of Banners (campaign picker)', () => {
  it('lists every campaign with rank, hoard, and coverage', async () => {
    const { lastFrame, unmount } = await openHall([
      entry('/realm/keep'),
      entry('/realm/uncharted', { save: null }),
    ]);
    const frame = lastFrame()!;
    expect(frame).toContain('Quest here: /realm/suggested');
    expect(frame).toContain('keep');
    expect(frame).toContain('Knight-Errant of the Red Diff');
    expect(frame).toContain('800 XP');
    expect(frame).toContain('61.5% covered');
    expect(frame).toContain('unplayed — a blank page awaits');
    expect(frame).toContain('Chart a new realm');
    unmount();
  });

  it('rides into the chosen realm on enter', async () => {
    const { stdin, hooks, unmount } = await openHall([entry('/realm/keep')]);
    stdin.write(DOWN); // suggested → keep
    await settle();
    stdin.write('\r');
    await settle();
    expect(hooks.chosen).toEqual(['/realm/keep']);
    unmount();
  });

  it('rides into the suggested realm without any saves at all', async () => {
    const { stdin, hooks, unmount } = await openHall([]);
    stdin.write('\r');
    await settle();
    expect(hooks.chosen).toEqual(['/realm/suggested']);
    unmount();
  });

  it('refuses a realm that no longer stands', async () => {
    const { lastFrame, stdin, hooks, unmount } = await openHall([
      entry('/realm/vanished', { exists: false }),
    ]);
    stdin.write(DOWN);
    await settle();
    stdin.write('\r');
    await settle();
    expect(hooks.chosen).toEqual([]);
    expect(lastFrame()).toContain('no longer stands');
    unmount();
  });

  it('charts a new realm from a typed path', async () => {
    const { stdin, hooks, unmount } = await openHall([], {
      exists: (p) => p === resolve('/realm', 'new-keep'),
    });
    stdin.write(DOWN); // suggested → chart
    await settle();
    stdin.write('\r'); // open the quill
    await settle();
    stdin.write('new-keep');
    await settle();
    stdin.write('\r');
    await settle();
    expect(hooks.charted).toEqual([resolve('/realm', 'new-keep')]);
    unmount();
  });

  it('refuses to chart a path that does not stand', async () => {
    const { lastFrame, stdin, hooks, unmount } = await openHall([], {
      exists: () => false,
    });
    stdin.write(DOWN);
    await settle();
    stdin.write('\r');
    await settle();
    stdin.write('nowhere');
    await settle();
    stdin.write('\r');
    await settle();
    expect(hooks.charted).toEqual([]);
    expect(lastFrame()).toContain('No realm stands at');
    unmount();
  });
});
