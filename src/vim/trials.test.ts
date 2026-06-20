import { describe, expect, it } from 'vitest';
import type { TrialResult, VimProgress } from '../types.js';
import { createVimBuffer, goalMet, keysFromString, playKeys, vimKey } from './engine.js';
import {
  TRIALS,
  applyTrial,
  bladeFor,
  newVimProgress,
  nextTrial,
  starsFor,
  trialXp,
} from './trials.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeResult(overrides: Partial<TrialResult> & { trialId: string }): TrialResult {
  return {
    keystrokes: 3,
    par: 3,
    durationMs: 5000,
    hintsUsed: 0,
    stars: 3,
    xpEarned: 30,
    blade: 1.5,
    ...overrides,
  };
}

/** Apply a result for every trial of a tier at the given star level. */
function masterTier(progress: VimProgress, tier: number, stars: 1 | 2 | 3): VimProgress {
  return TRIALS.filter((t) => t.tier === tier).reduce(
    (p, t) =>
      applyTrial(
        p,
        makeResult({ trialId: t.id, par: t.par, keystrokes: t.par, stars, blade: bladeFor(stars) }),
      ),
    progress,
  );
}

// ── The curriculum scroll itself ─────────────────────────────────────────────

describe('TRIALS curriculum structure', () => {
  it('gives every tier a worthwhile run of trials (at least 2 each)', () => {
    // Tiers 1–5 are the settled core (4–6 each). Tier 6 grew when the multiline
    // arts joined it; tiers 7–8 (Advanced and Macro Arts) are smaller capstones.
    for (let tier = 1; tier <= 8; tier++) {
      const count = TRIALS.filter((t) => t.tier === tier).length;
      expect(count, `tier ${tier} trial count`).toBeGreaterThanOrEqual(2);
    }
    expect(TRIALS.every((t) => t.tier >= 1 && t.tier <= 8)).toBe(true);
  });

  it('lists trials in tier order (the curriculum reads top to bottom)', () => {
    const tiers = TRIALS.map((t) => t.tier);
    expect([...tiers].sort((a, b) => a - b)).toEqual(tiers);
  });

  it('has unique ids', () => {
    const ids = TRIALS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every trial carries a full lesson card and a three-rung hint ladder', () => {
    for (const t of TRIALS) {
      expect(t.title.length, t.id).toBeGreaterThan(0);
      expect(t.lesson.heading.length, t.id).toBeGreaterThan(0);
      expect(t.lesson.body.length, t.id).toBeGreaterThan(40); // a real explanation, not a stub
      expect(t.lesson.demoKeys.length, t.id).toBeGreaterThan(0);
      expect(t.hints).toHaveLength(3);
      for (const hint of t.hints) expect(hint.length, t.id).toBeGreaterThan(10);
      expect(t.keysTaught.length, t.id).toBeGreaterThan(0);
      expect(t.par, t.id).toBeGreaterThan(0);
    }
  });

  it('start cursors sit on legal ground (createVimBuffer does not need to clamp them)', () => {
    for (const t of TRIALS) {
      const buf = createVimBuffer(t.startLines, t.startCursor);
      expect(buf.cursor, t.id).toEqual(t.startCursor);
    }
  });

  it('no trial starts already at its goal', () => {
    for (const t of TRIALS) {
      const buf = createVimBuffer(t.startLines, t.startCursor);
      expect(goalMet(buf, t.goal), t.id).toBe(false);
    }
  });
});

describe('TRIALS par solutions (replayed through the real engine)', () => {
  for (const t of TRIALS) {
    describe(`${t.id} — ${t.title}`, () => {
      const keys = keysFromString(t.parSolution);

      it(`parSolution is exactly par (${t.par}) keystrokes`, () => {
        expect(keys.length).toBe(t.par);
      });

      it('every keystroke of the parSolution is handled', () => {
        let buf = createVimBuffer(t.startLines, t.startCursor);
        for (const key of keys) {
          const res = vimKey(buf, key);
          expect(res.handled, `key ${JSON.stringify(key)} in ${t.parSolution}`).toBe(true);
          buf = res.buffer;
        }
      });

      it('replaying the parSolution meets the goal', () => {
        const final = playKeys(createVimBuffer(t.startLines, t.startCursor), t.parSolution);
        expect(goalMet(final, t.goal)).toBe(true);
      });

      it('ends back in normal mode with nothing pending', () => {
        const final = playKeys(createVimBuffer(t.startLines, t.startCursor), t.parSolution);
        expect(final.mode).toBe('normal');
        expect(final.pendingOperator).toBeNull();
        expect(final.pendingCount).toBeNull();
      });
    });
  }
});

describe('TRIALS teaching shape', () => {
  it('tier 1 scrolls are short (1–3 lines)', () => {
    for (const t of TRIALS.filter((t) => t.tier === 1)) {
      expect(t.startLines.length, t.id).toBeLessThanOrEqual(3);
    }
  });

  it('tier 5 includes scrolls of six lines or more', () => {
    const tier5 = TRIALS.filter((t) => t.tier === 5);
    expect(Math.max(...tier5.map((t) => t.startLines.length))).toBeGreaterThanOrEqual(6);
    for (const t of tier5) expect(t.startLines.length, t.id).toBeGreaterThanOrEqual(5);
  });

  it('the curriculum covers the canonical key groups in order', () => {
    const taughtAt = (key: string) => TRIALS.find((t) => t.keysTaught.includes(key))?.tier;
    expect(taughtAt('l')).toBe(1);
    expect(taughtAt('x')).toBe(1);
    expect(taughtAt('w')).toBe(2);
    expect(taughtAt('G')).toBe(2);
    expect(taughtAt('d')).toBe(3);
    expect(taughtAt('p')).toBe(3);
    expect(taughtAt('i')).toBe(4);
    expect(taughtAt('c')).toBe(4);
    expect(taughtAt('iw')).toBe(5);
    expect(taughtAt('i{')).toBe(5);
    expect(taughtAt('f')).toBe(6);
    expect(taughtAt('/')).toBe(6);
  });
});

// ── Scoring ──────────────────────────────────────────────────────────────────

describe('starsFor', () => {
  it('grants 3 stars at par or better with no hints', () => {
    expect(starsFor(5, 5, 0)).toBe(3);
    expect(starsFor(4, 5, 0)).toBe(3);
  });

  it('withholds the third star when hints were taken, even at par', () => {
    expect(starsFor(5, 5, 1)).toBe(2);
    expect(starsFor(4, 5, 3)).toBe(2);
  });

  it('grants 2 stars within twice par', () => {
    expect(starsFor(6, 5, 0)).toBe(2);
    expect(starsFor(10, 5, 0)).toBe(2);
    expect(starsFor(10, 5, 3)).toBe(2);
  });

  it('grants 1 star for any bloodier completion', () => {
    expect(starsFor(11, 5, 0)).toBe(1);
    expect(starsFor(100, 5, 2)).toBe(1);
  });
});

describe('trialXp', () => {
  it('pays more for brighter stars and deeper tiers', () => {
    expect(trialXp(3, 1)).toBeGreaterThan(trialXp(2, 1));
    expect(trialXp(2, 1)).toBeGreaterThan(trialXp(1, 1));
    expect(trialXp(3, 6)).toBeGreaterThan(trialXp(3, 1));
  });

  it('is deterministic and positive across the whole grid', () => {
    for (const stars of [1, 2, 3] as const) {
      for (let tier = 1; tier <= 8; tier++) {
        expect(trialXp(stars, tier)).toBeGreaterThan(0);
        expect(trialXp(stars, tier)).toBe(trialXp(stars, tier));
      }
    }
  });

  it('pays a 3-star tier-6 run handsomely (180)', () => {
    expect(trialXp(3, 6)).toBe(180);
  });
});

describe('bladeFor', () => {
  it('maps stars to the spec multipliers 1.0 / 1.2 / 1.5', () => {
    expect(bladeFor(1)).toBe(1.0);
    expect(bladeFor(2)).toBe(1.2);
    expect(bladeFor(3)).toBe(1.5);
  });
});

// ── Progression ──────────────────────────────────────────────────────────────

describe('newVimProgress', () => {
  it('starts empty, tier 1 only, no blade buff', () => {
    expect(newVimProgress()).toEqual({ results: {}, unlockedTier: 1, bladeBuff: 1 });
  });
});

describe('applyTrial', () => {
  const t1 = TRIALS.filter((t) => t.tier === 1);

  it('bootstraps progress when none exists (old saves)', () => {
    const result = makeResult({ trialId: t1[0].id });
    const p = applyTrial(undefined, result);
    expect(p.results[t1[0].id]).toEqual(result);
    expect(p.unlockedTier).toBe(1);
  });

  it('keeps the better of two results (stars first)', () => {
    const weak = makeResult({ trialId: t1[0].id, stars: 1, keystrokes: 20, blade: 1.0, xpEarned: 10 });
    const strong = makeResult({ trialId: t1[0].id, stars: 3, keystrokes: 3, blade: 1.5 });
    let p = applyTrial(undefined, weak);
    p = applyTrial(p, strong);
    expect(p.results[t1[0].id]).toEqual(strong);
    // A later, worse run does not erase the triumph.
    p = applyTrial(p, weak);
    expect(p.results[t1[0].id]).toEqual(strong);
  });

  it('on equal stars prefers fewer keystrokes', () => {
    const slow = makeResult({ trialId: t1[0].id, stars: 2, keystrokes: 6, hintsUsed: 1 });
    const swift = makeResult({ trialId: t1[0].id, stars: 2, keystrokes: 4, hintsUsed: 1 });
    let p = applyTrial(undefined, slow);
    p = applyTrial(p, swift);
    expect(p.results[t1[0].id].keystrokes).toBe(4);
  });

  it('does not unlock tier 2 with only two mastered tier-1 trials', () => {
    let p = newVimProgress();
    for (const t of t1.slice(0, 2)) {
      p = applyTrial(p, makeResult({ trialId: t.id, stars: 2, blade: 1.2 }));
    }
    expect(p.unlockedTier).toBe(1);
  });

  it('unlocks tier 2 once three tier-1 trials hold 2+ stars', () => {
    let p = newVimProgress();
    for (const t of t1.slice(0, 3)) {
      p = applyTrial(p, makeResult({ trialId: t.id, stars: 2, blade: 1.2 }));
    }
    expect(p.unlockedTier).toBe(2);
  });

  it('1-star completions do not count toward unlocking', () => {
    let p = newVimProgress();
    for (const t of t1) {
      p = applyTrial(p, makeResult({ trialId: t.id, stars: 1, keystrokes: 99, blade: 1.0 }));
    }
    expect(p.unlockedTier).toBe(1);
  });

  it('never re-locks a tier already won', () => {
    let p = masterTier(newVimProgress(), 1, 2);
    expect(p.unlockedTier).toBe(2);
    // A fresh 1-star result elsewhere must not shrink the unlocked tier.
    p = applyTrial(p, makeResult({ trialId: TRIALS.find((t) => t.tier === 2)!.id, stars: 1, keystrokes: 50, blade: 1.0 }));
    expect(p.unlockedTier).toBe(2);
  });

  it('keeps the brightest blade buff of the session', () => {
    let p = applyTrial(undefined, makeResult({ trialId: t1[0].id, stars: 3, blade: 1.5 }));
    expect(p.bladeBuff).toBe(1.5);
    p = applyTrial(p, makeResult({ trialId: t1[1].id, stars: 1, keystrokes: 30, blade: 1.0 }));
    expect(p.bladeBuff).toBe(1.5);
  });

  it('preserves unknown future fields on progress (spread-safe saves)', () => {
    const exotic = { ...newVimProgress(), heirloom: 'vorpal' } as VimProgress & { heirloom: string };
    const p = applyTrial(exotic, makeResult({ trialId: t1[0].id }));
    expect((p as typeof exotic).heirloom).toBe('vorpal');
  });

  it('mastering every tier in sequence opens the whole school', () => {
    let p = newVimProgress();
    // Mastering tiers 1..7 in turn flings open the gate to the final tier, 8.
    for (let tier = 1; tier <= 7; tier++) {
      expect(p.unlockedTier).toBe(tier);
      p = masterTier(p, tier, 3);
    }
    expect(p.unlockedTier).toBe(8); // tier 8 — the Macro Arts — is the last gate
  });

  it('mastering a locked tier early does not skip gates', () => {
    // Results for tier-2 trials while only tier 1 is unlocked must not open tier 3.
    let p = masterTier(newVimProgress(), 2, 3);
    expect(p.unlockedTier).toBe(1);
    // ...but once tier 1 falls, the stored tier-2 mastery cascades through.
    p = masterTier(p, 1, 3);
    expect(p.unlockedTier).toBe(3);
  });
});

describe('nextTrial', () => {
  it('offers the very first trial to a fresh knight (and to absent progress)', () => {
    expect(nextTrial(newVimProgress())?.id).toBe(TRIALS[0].id);
    expect(nextTrial(undefined)?.id).toBe(TRIALS[0].id);
  });

  it('skips completed trials and offers the next unattempted one', () => {
    const p = applyTrial(undefined, makeResult({ trialId: TRIALS[0].id }));
    expect(nextTrial(p)?.id).toBe(TRIALS[1].id);
  });

  it('never offers a trial from a locked tier', () => {
    let p = newVimProgress();
    for (const t of TRIALS.filter((t) => t.tier === 1)) {
      p = applyTrial(p, makeResult({ trialId: t.id, stars: 1, keystrokes: 40, blade: 1.0 }));
    }
    // Tier 1 fully attempted at 1 star: tier 2 stays locked, so revisits are offered.
    expect(p.unlockedTier).toBe(1);
    const offered = nextTrial(p);
    expect(offered).not.toBeNull();
    expect(offered!.tier).toBe(1);
  });

  it('prefers fresh material: after 2-starring tier 1, offers the first tier-2 trial', () => {
    const p = masterTier(newVimProgress(), 1, 2); // all tier 1 at 2 stars, tier 2 unlocked
    const offered = nextTrial(p);
    expect(offered?.id).toBe(TRIALS.find((t) => t.tier === 2)!.id);
  });

  it('offers sub-3-star trials for polish once every unlocked trial is attempted', () => {
    // 2-star tiers 1 and 2 but leave tier 3 locked? No — 2-starring tier 2 unlocks 3.
    // Instead: 3-star all of tier 1 except one trial, which gets 2 stars; tier 2 then
    // gets 3 stars everywhere. The lone 2-star tier-1 trial is the only one left.
    let p = newVimProgress();
    const tier1 = TRIALS.filter((t) => t.tier === 1);
    for (const t of tier1.slice(0, -1)) {
      p = applyTrial(p, makeResult({ trialId: t.id, par: t.par, keystrokes: t.par }));
    }
    const straggler = tier1[tier1.length - 1];
    p = applyTrial(
      p,
      makeResult({ trialId: straggler.id, par: straggler.par, keystrokes: straggler.par, hintsUsed: 1, stars: 2, blade: 1.2 }),
    );
    for (let tier = 2; tier <= 8; tier++) p = masterTier(p, tier, 3);
    expect(nextTrial(p)?.id).toBe(straggler.id);
  });

  it('returns null only when every trial in the school is 3-starred', () => {
    let p = newVimProgress();
    for (let tier = 1; tier <= 8; tier++) p = masterTier(p, tier, 3);
    expect(p.unlockedTier).toBe(8);
    expect(Object.keys(p.results)).toHaveLength(TRIALS.length);
    expect(nextTrial(p)).toBeNull();
  });
});
