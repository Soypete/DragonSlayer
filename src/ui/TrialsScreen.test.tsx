/**
 * Ride-through of the Sword-School: roster → lesson → practice → scored →
 * debrief, with simulated keystrokes. The harness below plays the Keep's
 * part: it adopts every chronicled save so the screen sees fresh props,
 * exactly as App.commit does (minus the disk write).
 *
 * Keystroke-timing quirk (same as App.test.tsx): Ink attaches its stdin
 * listener in a passive effect, so every stdin.write must be followed by a
 * settle() beat before the next write or assertion.
 */

import { describe, expect, it } from 'vitest';
import React, { useState } from 'react';
import { Text } from 'ink';
import { render } from 'ink-testing-library';
import type { SaveGame } from '../types.js';
import { TRIALS, newVimProgress } from '../vim/trials.js';
import { TrialsScreen } from './screens/TrialsScreen.js';

const ESC = '';

function saveOf(overrides: Partial<SaveGame> = {}): SaveGame {
  return {
    version: 1,
    repoPath: '/keep/of/greyhollow',
    xp: 0,
    gold: 20,
    rank: 'page',
    dragons: [],
    quests: [],
    stats: { battles: 0, bestWpm: 0, bestAccuracy: 0, totalKeystrokes: 0, dragonsSlain: 0 },
    ...overrides,
  };
}

/** Stands in for the Keep: adopts chronicled saves, notes a retreat. */
function Harness({ initial, chronicles }: { initial: SaveGame; chronicles: SaveGame[] }) {
  const [save, setSave] = useState(initial);
  const [left, setLeft] = useState(false);
  if (left) return <Text>back at the realm map</Text>;
  return (
    <TrialsScreen
      save={save}
      onChronicle={(next) => {
        chronicles.push(next);
        setSave(next);
      }}
      onBack={() => setLeft(true)}
    />
  );
}

const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));

async function bootSchool(initial = saveOf()) {
  const chronicles: SaveGame[] = [];
  const instance = render(<Harness initial={initial} chronicles={chronicles} />);
  await settle();
  return { ...instance, chronicles };
}

/** Walk trial 1 (Eastward, Squire — par lll) from roster to the scored rep. */
async function reachScored(stdin: { write: (s: string) => void }) {
  stdin.write('\r'); // roster → lesson
  await settle();
  stdin.write('\r'); // lesson → practice
  await settle();
  stdin.write('lll'); // fulfil the practice rep
  await settle();
  stdin.write('\r'); // practice → scored
  await settle();
}

describe('the Sword-School — trial roster', () => {
  it('musters the trials by tier with stars, par, and sealed gates', async () => {
    const { lastFrame, unmount } = await bootSchool();
    const frame = lastFrame()!;
    expect(frame).toContain('The Sword-School');
    expect(frame).toContain("Tier 1 — The Squire's Footwork");
    expect(frame).toContain('❯ ☆☆☆ Eastward, Squire');
    expect(frame).toContain('par 3');
    expect(frame).toContain('🔒 Tier 2');
    expect(frame).toContain('sealed until the gate opens');
    expect(frame).toContain('⛁ 20 gold');
    unmount();
  });

  it('shows earned stars and the waiting blade buff', async () => {
    const progress = {
      ...newVimProgress(),
      bladeBuff: 1.5,
      results: {
        't1-eastward-squire': {
          trialId: 't1-eastward-squire',
          keystrokes: 3,
          par: 3,
          durationMs: 1_000,
          hintsUsed: 0,
          stars: 3 as const,
          xpEarned: 30,
          blade: 1.5,
        },
      },
    };
    const { lastFrame, unmount } = await bootSchool(saveOf({ vim: progress }));
    expect(lastFrame()).toContain('★★★ Eastward, Squire');
    expect(lastFrame()).toContain('blade ×1.5 awaits the next battle');
    unmount();
  });

  it('roams with j/k and leaps with G and gg', async () => {
    const { lastFrame, stdin, unmount } = await bootSchool();
    stdin.write('j');
    await settle();
    expect(lastFrame()).toContain('❯ ☆☆☆ Down the Spiral Stair');
    stdin.write('k');
    await settle();
    expect(lastFrame()).toContain('❯ ☆☆☆ Eastward, Squire');
    stdin.write('G');
    await settle();
    expect(lastFrame()).toContain(`❯ ☆☆☆ ${TRIALS[TRIALS.length - 1].title}`);
    stdin.write('g');
    await settle();
    stdin.write('g');
    await settle();
    expect(lastFrame()).toContain('❯ ☆☆☆ Eastward, Squire');
    unmount();
  });

  it('refuses a sealed trial but yields to esc', async () => {
    const { lastFrame, stdin, unmount } = await bootSchool();
    stdin.write('G'); // last trial (tier 7) — sealed for a fresh squire
    await settle();
    stdin.write('\r');
    await settle();
    expect(lastFrame()).toContain('Earn 2★'); // still the roster
    stdin.write(ESC);
    await settle();
    expect(lastFrame()).toContain('back at the realm map');
    unmount();
  });
});

describe('the Sword-School — lesson card', () => {
  it('teaches before it tests: heading, body, par, demo, goal', async () => {
    const { lastFrame, stdin, unmount } = await bootSchool();
    stdin.write('\r');
    await settle();
    const frame = lastFrame()!;
    expect(frame).toContain('l walks right, h walks left');
    expect(frame).toContain('letter keys ARE your feet');
    expect(frame).toContain('in 3 keystrokes');
    expect(frame).toContain('(0/2 played)');
    expect(frame).toContain('Goal: rest the cursor on line 1, column 4.');
    unmount();
  });

  it('steps the demo one key per space and wraps at the end', async () => {
    const { lastFrame, stdin, unmount } = await bootSchool();
    stdin.write('\r');
    await settle();
    stdin.write(' ');
    await settle();
    expect(lastFrame()).toContain('(1/2 played)');
    stdin.write(' ');
    await settle();
    expect(lastFrame()).toContain('(2/2 played)');
    stdin.write(' '); // wraps back to the start
    await settle();
    expect(lastFrame()).toContain('(0/2 played)');
    unmount();
  });
});

describe('the Sword-School — practice and scored reps', () => {
  it('runs an untimed practice rep and announces fulfilment', async () => {
    const { lastFrame, stdin, unmount } = await bootSchool();
    stdin.write('\r');
    await settle();
    stdin.write('\r');
    await settle();
    expect(lastFrame()).toContain('practice rep (untimed)');
    expect(lastFrame()).toContain('go east, brave squire');
    expect(lastFrame()).toContain('NORMAL');
    stdin.write('lll');
    await settle();
    expect(lastFrame()).toContain('✓ The goal is met!');
    unmount();
  });

  it('lets r restart a botched practice rep', async () => {
    const { lastFrame, stdin, unmount } = await bootSchool();
    stdin.write('\r');
    await settle();
    stdin.write('\r');
    await settle();
    stdin.write('x'); // mangle the scroll: "o east, brave squire"
    await settle();
    expect(lastFrame()).toContain('o east, brave squire');
    stdin.write('r');
    await settle();
    expect(lastFrame()).toContain('go east, brave squire');
    unmount();
  });

  it('scores a par run: live strokes, then a three-star debrief', async () => {
    const { lastFrame, stdin, chronicles, unmount } = await bootSchool();
    await reachScored(stdin);
    expect(lastFrame()).toContain('SCORED ATTEMPT');
    expect(lastFrame()).toContain('Strokes 0 / par 3');
    stdin.write('ll');
    await settle();
    expect(lastFrame()).toContain('Strokes 2 / par 3');
    stdin.write('l');
    await settle();

    const frame = lastFrame()!;
    expect(frame).toContain('★★★');
    expect(frame).toContain('the trial stands fulfilled');
    expect(frame).toContain('XP +30');
    expect(frame).toContain('×1.5 sharpened for the next battle');
    expect(frame).toContain('Flawless form');
    expect(frame).toContain('lll'); // your keys and the par scripture

    const chronicled = chronicles.at(-1)!;
    expect(chronicled.xp).toBe(30);
    expect(chronicled.vim?.results['t1-eastward-squire']?.stars).toBe(3);
    expect(chronicled.vim?.bladeBuff).toBe(1.5);
    unmount();
  });

  it('counts wasted keystrokes against the knight', async () => {
    const { lastFrame, stdin, chronicles, unmount } = await bootSchool();
    await reachScored(stdin);
    stdin.write('hh'); // clamped at column 0 — wasted
    await settle();
    stdin.write('lll');
    await settle();
    expect(lastFrame()).toContain('★★☆'); // 5 strokes vs par 3, within 2× par
    expect(chronicles.at(-1)!.vim?.results['t1-eastward-squire']?.keystrokes).toBe(5);
    unmount();
  });

  it('abandons a scored attempt with esc, recording nothing', async () => {
    const { lastFrame, stdin, chronicles, unmount } = await bootSchool();
    await reachScored(stdin);
    stdin.write(ESC); // q now belongs to the blade (macro recording); esc abandons
    await settle();
    expect(lastFrame()).toContain('The Sword-School'); // back at the roster
    expect(chronicles).toHaveLength(0);
    unmount();
  });

  it('q reaches the blade during a rep — it records, it does not abandon', async () => {
    const { lastFrame, stdin, unmount } = await bootSchool();
    await reachScored(stdin);
    stdin.write('qal'); // start recording into a, take one step
    await settle();
    stdin.write('q'); // stop recording — this must NOT bounce us to the roster
    await settle();
    expect(lastFrame()).not.toContain('The Sword-School'); // still in the scored rep
    expect(lastFrame()).toContain('SCORED ATTEMPT');
    unmount();
  });
});

describe('the Sword-School — the hint ladder', () => {
  it('whispers the first rung free, then charges 5 gold a rung', async () => {
    const { lastFrame, stdin, chronicles, unmount } = await bootSchool();
    stdin.write('\r');
    await settle();
    stdin.write('\r'); // practice
    await settle();

    stdin.write('?');
    await settle();
    expect(lastFrame()).toContain('Hint 1 (a nudge)');
    expect(chronicles).toHaveLength(0); // the nudge costs nothing

    stdin.write('?');
    await settle();
    expect(lastFrame()).toContain('Hint 2 (the exact keys)');
    expect(lastFrame()).toContain('Press l three times');
    expect(chronicles.at(-1)!.gold).toBe(15);

    stdin.write('?');
    await settle();
    expect(lastFrame()).toContain('Hint 3 (the full walkthrough)');
    expect(chronicles.at(-1)!.gold).toBe(10);
    unmount();
  });

  it('waives the toll when the purse is too light', async () => {
    const { lastFrame, stdin, chronicles, unmount } = await bootSchool(saveOf({ gold: 3 }));
    stdin.write('\r');
    await settle();
    stdin.write('\r');
    await settle();
    stdin.write('?');
    await settle();
    expect(lastFrame()).toContain('the guild waives the fee');
    stdin.write('?');
    await settle();
    expect(lastFrame()).toContain('Hint 2 (the exact keys)');
    expect(chronicles).toHaveLength(0); // no gold ever taken
    unmount();
  });

  it('hints taken cap a par run at two stars', async () => {
    const { lastFrame, stdin, chronicles, unmount } = await bootSchool();
    stdin.write('\r');
    await settle();
    stdin.write('\r');
    await settle();
    stdin.write('?'); // one free nudge, remembered into the scored rep
    await settle();
    stdin.write('lll');
    await settle();
    stdin.write('\r'); // scored
    await settle();
    stdin.write('lll');
    await settle();
    expect(lastFrame()).toContain('★★☆');
    expect(lastFrame()).toContain('XP +20');
    expect(chronicles.at(-1)!.vim?.results['t1-eastward-squire']?.hintsUsed).toBe(1);
    unmount();
  });
});

describe('the Sword-School — onward from the debrief', () => {
  it('returns to the roster with enter, stars now lit', async () => {
    const { lastFrame, stdin, unmount } = await bootSchool();
    await reachScored(stdin);
    stdin.write('lll');
    await settle();
    stdin.write('\r');
    await settle();
    expect(lastFrame()).toContain('★★★ Eastward, Squire');
    expect(lastFrame()).toContain('blade ×1.5 awaits the next battle');
    unmount();
  });

  it('rides straight to the next trial with n', async () => {
    const { lastFrame, stdin, unmount } = await bootSchool();
    await reachScored(stdin);
    stdin.write('lll');
    await settle();
    stdin.write('n');
    await settle();
    // Trial 2's lesson card: Down the Spiral Stair.
    expect(lastFrame()).toContain('j goes down, k goes up');
    unmount();
  });
});
