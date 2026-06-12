import { describe, expect, it } from 'vitest';
import type {
  Augury,
  BattleResult,
  CoverageData,
  Dragon,
  Quest,
  RepoScan,
  SaveGame,
  TrialResult,
  TypingSnippet,
} from '../types.js';
import { newSave } from '../game/state.js';
import { createVimBuffer, playKeys } from '../vim/engine.js';
import { TRIALS, newVimProgress } from '../vim/trials.js';
import {
  armoryWarnings,
  blessSpoils,
  localDay,
  padSnippets,
  pledgeBanner,
  questBountyXp,
  chronicleScan,
  chronicleTrial,
  debriefLine,
  dullBlade,
  forgeTrialResult,
  hintToll,
  musterCampaignEntries,
  musterRoster,
  scribeKeys,
  scrollWindow,
  sharpenSpoils,
  starGlyphs,
  trialFulfilled,
  HINT_COST,
  SCROLLS_PER_BATTLE,
} from './logic.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function metric(total: number, covered: number) {
  return { total, covered, pct: total === 0 ? 100 : (covered / total) * 100 };
}

function coverageOf(pct: number): CoverageData {
  const covered = Math.round(pct);
  return {
    files: [],
    totals: {
      lines: metric(100, covered),
      statements: metric(100, covered),
      functions: metric(10, Math.round(pct / 10)),
      branches: metric(10, Math.round(pct / 10)),
    },
    source: 'coverage/coverage-summary.json',
    generatedAt: 1_000,
  };
}

function scanOf(pct: number, overrides: Partial<RepoScan> = {}): RepoScan {
  return {
    repoPath: '/keep/of/greyhollow',
    coverage: coverageOf(pct),
    playwright: { configured: false, specCount: 0 },
    ci: { workflows: [], hasTestJob: false },
    sourceFiles: ['src/moat.ts', 'src/drawbridge.ts'],
    testFiles: ['tests/drawbridge.test.ts'],
    scannedAt: 2_000,
    ...overrides,
  };
}

function dragonOf(file: string, hp: number, slain = false): Dragon {
  return {
    id: file,
    file,
    name: `Vexmaw of ${file}`,
    species: 'Null Drake',
    maxHp: Math.max(hp, 1),
    hp,
    weakened: 0,
    slain,
    coveragePct: slain ? 100 : 0,
  };
}

function questOf(id: string, status: Quest['status'], xpReward = 100): Quest {
  return {
    id,
    kind: 'coverage',
    title: id,
    description: 'a deed',
    objectives: [{ id: `${id}:obj`, description: 'do it', done: status === 'complete' }],
    xpReward,
    status,
  };
}

// ── padSnippets ──────────────────────────────────────────────────────────────

describe('armoryWarnings — naming the bare racks', () => {
  it('merges duties for one missing blade and keeps the install pointer', () => {
    const lines = armoryWarnings([
      { binary: 'cargo', installUrl: 'https://rustup.rs', neededFor: 'tests' },
      { binary: 'cargo', installUrl: 'https://rustup.rs', neededFor: 'coverage' },
    ]);
    expect(lines).toEqual([
      'cargo not found in the armory — tests & coverage will fail. Install: https://rustup.rs',
    ]);
  });

  it('omits the pointer when none is known', () => {
    expect(
      armoryWarnings([{ binary: 'pixi', installUrl: '', neededFor: 'tests' }])
    ).toEqual(['pixi not found in the armory — tests will fail']);
  });

  it('stays silent over a stocked armory', () => {
    expect(armoryWarnings([])).toEqual([]);
  });
});

describe('padSnippets — the scroll satchel', () => {
  const scroll = (text: string): TypingSnippet => ({ text, source: 'src/moat.ts:1', kind: 'code' });

  it('keeps harvested scrolls when the lair is rich', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map(scroll);
    expect(padSnippets(five, 'src/moat.ts', SCROLLS_PER_BATTLE)).toEqual(five);
  });

  it('tops up a barren lair with incantations', () => {
    const satchel = padSnippets([scroll('one')], 'src/moat.ts', 3);
    expect(satchel).toHaveLength(3);
    expect(satchel[0]!.kind).toBe('code');
    expect(satchel[1]!.kind).toBe('incantation');
    expect(satchel[2]!.kind).toBe('incantation');
  });

  it('fills entirely from the spellbook when nothing was harvested', () => {
    const satchel = padSnippets([], 'src/moat.ts', SCROLLS_PER_BATTLE);
    expect(satchel).toHaveLength(SCROLLS_PER_BATTLE);
    expect(satchel.every((s) => s.kind === 'incantation')).toBe(true);
  });

  it('trims an overfull harvest down to count', () => {
    const seven = 'abcdefg'.split('').map(scroll);
    expect(padSnippets(seven, 'src/moat.ts', 5)).toHaveLength(5);
  });
});

// ── questBountyXp ────────────────────────────────────────────────────────────

describe('questBountyXp — the guild pays its debts', () => {
  it('pays for quests newly completed', () => {
    const before = [questOf('coverage:50', 'available', 150)];
    const after = [questOf('coverage:50', 'complete', 150)];
    expect(questBountyXp(before, after)).toBe(150);
  });

  it('never pays twice for the same deed', () => {
    const done = [questOf('coverage:50', 'complete', 150)];
    expect(questBountyXp(done, done)).toBe(0);
  });

  it('sums multiple bounties', () => {
    const before = [questOf('coverage:50', 'active', 150), questOf('tdd', 'available', 80)];
    const after = [questOf('coverage:50', 'complete', 150), questOf('tdd', 'complete', 80)];
    expect(questBountyXp(before, after)).toBe(230);
  });

  it('pays for brand-new quests born already complete', () => {
    expect(questBountyXp([], [questOf('ci', 'complete', 120)])).toBe(120);
  });
});

// ── chronicleScan ────────────────────────────────────────────────────────────

describe('chronicleScan — folding a scan into the chronicle', () => {
  it('establishes a baseline on the first scan with no coverage XP', () => {
    const save = newSave('/keep/of/greyhollow');
    const scan = scanOf(40);
    const next = chronicleScan(save, scan, [dragonOf('src/moat.ts', 60)]);
    expect(next.lastScan?.coveragePct).toBeCloseTo(40);
    expect(next.dragons).toHaveLength(1);
    expect(next.quests.length).toBeGreaterThan(0);
  });

  it('is pure — the prior save is untouched', () => {
    const save = newSave('/keep/of/greyhollow');
    const frozen = JSON.parse(JSON.stringify(save)) as SaveGame;
    chronicleScan(save, scanOf(40), [dragonOf('src/moat.ts', 60)]);
    expect(save).toEqual(frozen);
  });

  it('pays quest bounty XP when a scan completes a quest', () => {
    const save = newSave('/keep/of/greyhollow');
    const first = chronicleScan(save, scanOf(40), [dragonOf('src/moat.ts', 60)]);
    const fiftyQuest = first.quests.find((q) => q.id === 'coverage:50');
    expect(fiftyQuest?.status).not.toBe('complete');

    const second = chronicleScan(first, scanOf(60), [dragonOf('src/moat.ts', 40)]);
    const completed = second.quests.find((q) => q.id === 'coverage:50');
    expect(completed?.status).toBe('complete');
    // coverage delta XP (+15/percent * 20) plus the quest bounty.
    expect(second.xp).toBeGreaterThanOrEqual(first.xp + 300 + (completed?.xpReward ?? 0));
    expect(second.rank).toBeDefined();
  });

  it('credits a slain dragon when it vanishes from the fresh roster', () => {
    const save = newSave('/keep/of/greyhollow');
    const first = chronicleScan(save, scanOf(40), [dragonOf('src/moat.ts', 60)]);
    const second = chronicleScan(first, scanOf(100), []);
    const trophy = second.dragons.find((d) => d.id === 'src/moat.ts');
    expect(trophy?.slain).toBe(true);
    expect(trophy?.hp).toBe(0);
    expect(second.gold).toBeGreaterThanOrEqual(first.gold + 50);
  });
});

// ── musterRoster / scrollWindow ──────────────────────────────────────────────

describe('musterRoster — ordering the realm map', () => {
  it('lists living dragons first, trophies after, each by lair path', () => {
    const roster = musterRoster([
      dragonOf('src/z-living.ts', 5),
      dragonOf('src/a-slain.ts', 0, true),
      dragonOf('src/a-living.ts', 9),
    ]);
    expect(roster.map((d) => d.file)).toEqual([
      'src/a-living.ts',
      'src/z-living.ts',
      'src/a-slain.ts',
    ]);
  });
});

describe('musterCampaignEntries — the Hall of Banners roll', () => {
  const saveAt = (repoPath: string, timestamp?: number): SaveGame => ({
    ...newSave(repoPath),
    ...(timestamp !== undefined
      ? { lastScan: { coveragePct: 50, timestamp } }
      : {}),
  });

  it('unites saves and registry, deduped, with the save speaking for its realm', () => {
    const entries = musterCampaignEntries(
      [saveAt('/realm/keep', 5)],
      ['/realm/keep', '/realm/uncharted'],
      () => true,
    );
    expect(entries.map((e) => e.repoPath)).toEqual(['/realm/keep', '/realm/uncharted']);
    expect(entries[0]!.save).not.toBeNull();
    expect(entries[1]!.save).toBeNull();
  });

  it('rides freshest campaigns first, then the unplayed in path order', () => {
    const entries = musterCampaignEntries(
      [saveAt('/realm/old', 1), saveAt('/realm/new', 9)],
      ['/realm/b-uncharted', '/realm/a-uncharted'],
      () => true,
    );
    expect(entries.map((e) => e.repoPath)).toEqual([
      '/realm/new',
      '/realm/old',
      '/realm/a-uncharted',
      '/realm/b-uncharted',
    ]);
  });

  it('flags realms that no longer stand', () => {
    const entries = musterCampaignEntries(
      [saveAt('/realm/vanished')],
      [],
      () => false,
    );
    expect(entries[0]!.exists).toBe(false);
  });
});

describe('scrollWindow — keeping the chosen dragon in sight', () => {
  it('shows everything when the roster fits', () => {
    expect(scrollWindow(3, 0, 10)).toEqual([0, 3]);
  });
  it('centers the selection in long rosters', () => {
    expect(scrollWindow(20, 10, 6)).toEqual([7, 13]);
  });
  it('pins to the top and bottom edges', () => {
    expect(scrollWindow(20, 0, 6)).toEqual([0, 6]);
    expect(scrollWindow(20, 19, 6)).toEqual([14, 20]);
  });
});

// ── Sword-school glue ────────────────────────────────────────────────────────

describe('hintToll — the price of a whisper', () => {
  it('lets the first rung go free', () => {
    expect(hintToll(0, 0)).toBe(0);
    expect(hintToll(0, 100)).toBe(0);
  });
  it('charges the standing fee for rungs 2 and 3 when the purse allows', () => {
    expect(hintToll(1, 20)).toBe(HINT_COST);
    expect(hintToll(2, HINT_COST)).toBe(HINT_COST);
  });
  it('waives the fee when the knight is too poor to pay', () => {
    expect(hintToll(1, HINT_COST - 1)).toBe(0);
    expect(hintToll(2, 0)).toBe(0);
  });
});

describe('trialFulfilled — the trial stands only at rest', () => {
  const goal = { kind: 'cursor', row: 0, col: 3 } as const;
  const start = () => createVimBuffer(['go east, brave squire'], { row: 0, col: 0 });

  it('is met when the cursor rests on the goal in normal mode', () => {
    expect(trialFulfilled(playKeys(start(), 'lll'), goal)).toBe(true);
  });
  it('is not met while the quill is drawn (insert mode)', () => {
    expect(trialFulfilled(playKeys(start(), 'llli'), goal)).toBe(false);
  });
  it('is not met while an operator hangs half-spoken', () => {
    expect(trialFulfilled(playKeys(start(), 'llld'), goal)).toBe(false);
  });
  it('is not met while a count hangs half-spoken', () => {
    expect(trialFulfilled(playKeys(start(), 'lll3'), goal)).toBe(false);
  });
  it('is not met away from the goal', () => {
    expect(trialFulfilled(playKeys(start(), 'll'), goal)).toBe(false);
  });
});

describe('forgeTrialResult — striking the verdict', () => {
  const trial = TRIALS[0]!; // tier 1, par 3

  it('awards three stars, full XP and the keen blade at par without hints', () => {
    const result = forgeTrialResult(trial, trial.par, 0, 4_200);
    expect(result).toEqual<TrialResult>({
      trialId: trial.id,
      keystrokes: trial.par,
      par: trial.par,
      durationMs: 4_200,
      hintsUsed: 0,
      stars: 3,
      xpEarned: 30,
      blade: 1.5,
    });
  });
  it('caps a hinted par run at two stars', () => {
    const result = forgeTrialResult(trial, trial.par, 1, 1_000);
    expect(result.stars).toBe(2);
    expect(result.xpEarned).toBe(20);
    expect(result.blade).toBe(1.2);
  });
  it('grants one star for a bloodied finish beyond twice par', () => {
    const result = forgeTrialResult(trial, trial.par * 2 + 1, 0, 1_000);
    expect(result.stars).toBe(1);
    expect(result.xpEarned).toBe(10);
    expect(result.blade).toBe(1.0);
  });
});

describe('chronicleTrial — the trial spoils path', () => {
  const result: TrialResult = {
    trialId: 't1-eastward-squire',
    keystrokes: 3,
    par: 3,
    durationMs: 2_000,
    hintsUsed: 0,
    stars: 3,
    xpEarned: 30,
    blade: 1.5,
  };

  it('awards XP, re-judges the rank, and records the result', () => {
    const save = { ...newSave('/keep/of/greyhollow'), xp: 240 };
    const next = chronicleTrial(save, result);
    expect(next.xp).toBe(270);
    expect(next.rank).toBe('squire'); // 250 XP crossed by the trial
    expect(next.vim?.results['t1-eastward-squire']).toEqual(result);
    expect(next.vim?.bladeBuff).toBe(1.5);
  });
  it('creates vim progress for saves from before the sword-school', () => {
    const save = newSave('/keep/of/greyhollow');
    expect(save.vim).toBeUndefined();
    const next = chronicleTrial(save, result);
    expect(next.vim?.unlockedTier).toBe(1);
  });
  it('is pure — the prior save is untouched', () => {
    const save = newSave('/keep/of/greyhollow');
    const frozen = JSON.parse(JSON.stringify(save)) as SaveGame;
    chronicleTrial(save, result);
    expect(save).toEqual(frozen);
  });
});

describe('sharpenSpoils & dullBlade — the blade buff lifecycle', () => {
  const spoils: BattleResult = {
    wpm: 60,
    accuracy: 0.95,
    durationMs: 30_000,
    keystrokes: 200,
    mistakes: 5,
    damage: 33,
    xpEarned: 25,
  };

  it('multiplies damage by the blade and rounds to whole wounds', () => {
    expect(sharpenSpoils(spoils, 1.5).damage).toBe(50);
    expect(sharpenSpoils(spoils, 1.2).damage).toBe(40);
  });
  it('leaves the spoils alone for an unsharpened blade', () => {
    expect(sharpenSpoils(spoils, 1)).toBe(spoils);
  });
  it('never touches XP — only the wound', () => {
    expect(sharpenSpoils(spoils, 1.5).xpEarned).toBe(spoils.xpEarned);
  });
  it('dullBlade resets a spent buff to 1 and keeps the rest of the progress', () => {
    const save: SaveGame = {
      ...newSave('/keep/of/greyhollow'),
      vim: { ...newVimProgress(), unlockedTier: 3, bladeBuff: 1.5 },
    };
    const dulled = dullBlade(save);
    expect(dulled.vim?.bladeBuff).toBe(1);
    expect(dulled.vim?.unlockedTier).toBe(3);
  });
  it('dullBlade passes old saves (no vim) and unbuffed saves through unchanged', () => {
    const bare = newSave('/keep/of/greyhollow');
    expect(dullBlade(bare)).toBe(bare);
    const calm: SaveGame = { ...bare, vim: newVimProgress() };
    expect(dullBlade(calm)).toBe(calm);
  });
});

describe('scribeKeys & starGlyphs — the debrief scribe', () => {
  it('spells out every stroke, spaces included', () => {
    expect(scribeKeys(['l', 'l', ' ', '<esc>'])).toBe('ll␣<esc>');
  });
  it('renders stars lit and hollow', () => {
    expect(starGlyphs(0)).toBe('☆☆☆');
    expect(starGlyphs(2)).toBe('★★☆');
    expect(starGlyphs(3)).toBe('★★★');
  });
  it('clamps out-of-range star counts', () => {
    expect(starGlyphs(-1)).toBe('☆☆☆');
    expect(starGlyphs(9)).toBe('★★★');
  });
});

describe('debriefLine — one line of judgment', () => {
  it('hails a flawless unhinted par run', () => {
    expect(debriefLine(3, 3, 0)).toContain('Flawless');
  });
  it('notes when hints dimmed the third star', () => {
    expect(debriefLine(3, 3, 1)).toContain('hints');
  });
  it('counts the strokes to shave inside twice par', () => {
    expect(debriefLine(5, 3, 0)).toContain('Shave 2 strokes');
    expect(debriefLine(4, 3, 0)).toContain('Shave 1 stroke ');
  });
  it('consoles the bloodied beyond twice par', () => {
    expect(debriefLine(8, 3, 0)).toContain('bloodied');
  });
});

// ── Pledges & the daily augury — guild glue ──────────────────────────────────

describe('localDay — the calendar as the UI reads it', () => {
  it('formats local YYYY-MM-DD with zero padding', () => {
    expect(localDay(new Date(2026, 5, 9, 23, 59))).toBe('2026-06-09');
    expect(localDay(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });
});

describe('blessSpoils — the blessing rides the spoils path', () => {
  const spoils: BattleResult = {
    wpm: 60,
    accuracy: 0.95,
    durationMs: 30_000,
    keystrokes: 200,
    mistakes: 5,
    damage: 33,
    xpEarned: 25,
  };
  const auguryOf = (kind: Augury['kind'], date: string): Augury => ({
    date,
    kind,
    edict: 'tests first',
    proclamation: 'the smoke parts',
    snapshot: { coveragePct: 50, testFiles: 3, dragonsSlain: 1 },
    source: 'fallback',
  });

  it('multiplies battle XP ×1.1 (rounded) under a same-day blessing', () => {
    const blessed = blessSpoils(spoils, auguryOf('blessing', '2026-06-09'), '2026-06-09');
    expect(blessed.xpEarned).toBe(28); // round(25 × 1.1)
    expect(blessed.damage).toBe(spoils.damage); // XP only, never the wound
  });
  it('ignores curses, omens, and yesterday\'s blessings', () => {
    expect(blessSpoils(spoils, auguryOf('curse', '2026-06-09'), '2026-06-09')).toBe(spoils);
    expect(blessSpoils(spoils, auguryOf('omen', '2026-06-09'), '2026-06-09')).toBe(spoils);
    expect(blessSpoils(spoils, auguryOf('blessing', '2026-06-08'), '2026-06-09')).toBe(spoils);
    expect(blessSpoils(spoils, undefined, '2026-06-09')).toBe(spoils);
  });
});

describe('pledgeBanner — the standing reminder on the realm map', () => {
  const deeds: Quest[] = [
    {
      id: 'slay:src/moat.ts',
      kind: 'slay',
      title: 'Slay Vexmaw',
      description: '',
      objectives: [],
      xpReward: 100,
      status: 'available',
    },
    {
      id: 'coverage:75',
      kind: 'coverage',
      title: 'Three Quarters Warded',
      description: '',
      objectives: [],
      xpReward: 150,
      status: 'available',
    },
  ];

  it('stays silent when nothing is sworn', () => {
    expect(pledgeBanner(deeds, [])).toBeNull();
  });
  it('names the first pledged quest', () => {
    expect(pledgeBanner(deeds, ['slay:src/moat.ts'])).toBe('Pledged: Slay Vexmaw');
  });
  it('counts the rest of the sworn behind the first', () => {
    expect(pledgeBanner(deeds, ['slay:src/moat.ts', 'coverage:75'])).toBe(
      'Pledged: Slay Vexmaw (+1 more sworn)',
    );
  });
  it('ignores pledges whose quests left the board', () => {
    expect(pledgeBanner(deeds, ['ghost:quest'])).toBeNull();
  });
});
