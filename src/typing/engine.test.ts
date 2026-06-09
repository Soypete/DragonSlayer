import { describe, expect, it } from 'vitest';

import type { TypingSnippet } from '../types.js';
import {
  WITHDRAW_KEY,
  battleResult,
  createBattle,
  currentSnippet,
  elapsedMs,
  feedKey,
  type BattleState,
} from './engine.js';

const scroll = (text: string): TypingSnippet => ({ text, source: 'test', kind: 'code' });

/** Type every char of `text` correctly, with strikes evenly spread over [startMs, endMs]. */
function typeItTrue(state: BattleState, text: string, startMs: number, endMs: number): BattleState {
  const n = text.length;
  const step = n > 1 ? (endMs - startMs) / (n - 1) : 0;
  let s = state;
  for (let i = 0; i < n; i++) {
    s = feedKey(s, text[i]!, startMs + Math.round(i * step));
  }
  return s;
}

describe('createBattle', () => {
  it('forges a fresh, unjoined battle', () => {
    const state = createBattle([scroll('slay()')], 42);
    expect(state.snippetIndex).toBe(0);
    expect(state.typed).toEqual([]);
    expect(state.dragonHp).toBe(42);
    expect(state.combo).toBe(0);
    expect(state.finished).toBe(false);
    expect(state.startedAtMs).toBeNull();
    expect(currentSnippet(state)?.text).toBe('slay()');
  });

  it('declares an empty battle finished before it begins', () => {
    const state = createBattle([], 10);
    expect(state.finished).toBe(true);
    expect(currentSnippet(state)).toBeNull();
  });
});

describe('feedKey', () => {
  it('judges correct and incorrect strikes', () => {
    let s = createBattle([scroll('ab')], 5);
    s = feedKey(s, 'a', 100);
    expect(s.typed).toEqual([{ char: 'a', expected: 'a', correct: true }]);
    expect(s.correctChars).toBe(1);
    expect(s.mistakes).toBe(0);
    expect(s.lastKeystroke).toEqual({ correct: true, finished: false });

    s = feedKey(s, 'x', 200);
    // 'x' vs expected 'b' — a fumble, and it sealed the (2-char) snippet
    expect(s.mistakes).toBe(1);
    expect(s.correctChars).toBe(1);
    expect(s.lastKeystroke).toEqual({ correct: false, finished: true });
    expect(s.finished).toBe(true);
  });

  it('builds combo on clean strikes and shatters it on a fumble', () => {
    let s = createBattle([scroll('abcd')], 5);
    s = feedKey(s, 'a', 0);
    s = feedKey(s, 'b', 1);
    expect(s.combo).toBe(2);
    s = feedKey(s, 'Z', 2);
    expect(s.combo).toBe(0);
    expect(s.bestCombo).toBe(2);
    s = feedKey(s, 'd', 3);
    expect(s.combo).toBe(1);
    expect(s.bestCombo).toBe(2);
  });

  it('withdraws the last rune on backspace but keeps the mistake on the ledger', () => {
    let s = createBattle([scroll('ab')], 5);
    s = feedKey(s, 'q', 0); // fumble
    expect(s.mistakes).toBe(1);
    expect(s.typed).toHaveLength(1);

    s = feedKey(s, WITHDRAW_KEY, 10);
    expect(s.typed).toHaveLength(0);
    expect(s.mistakes).toBe(1); // dragons remember
    expect(s.keystrokes).toBe(1); // withdrawals are not strikes

    s = feedKey(s, 'a', 20);
    expect(s.typed).toEqual([{ char: 'a', expected: 'a', correct: true }]);
  });

  it('ignores backspace on an empty scroll', () => {
    const s = createBattle([scroll('ab')], 5);
    expect(feedKey(s, WITHDRAW_KEY, 0)).toBe(s);
  });

  it('advances to the next scroll when one is sealed', () => {
    let s = createBattle([scroll('ab'), scroll('cd')], 5);
    s = feedKey(s, 'a', 0);
    s = feedKey(s, 'b', 1);
    expect(s.snippetIndex).toBe(1);
    expect(s.typed).toEqual([]); // fresh scroll
    expect(s.finished).toBe(false);
    expect(currentSnippet(s)?.text).toBe('cd');

    s = feedKey(s, 'c', 2);
    s = feedKey(s, 'd', 3);
    expect(s.finished).toBe(true);
    expect(s.correctChars).toBe(4);
  });

  it('ignores keys after the battle is won and multi-char strings always', () => {
    let s = createBattle([scroll('a')], 5);
    const beforeFinish = feedKey(s, 'ab', 0); // multi-char: ignored
    expect(beforeFinish).toBe(s);

    s = feedKey(s, 'a', 0);
    expect(s.finished).toBe(true);
    expect(feedKey(s, 'z', 100)).toBe(s);
  });

  it('never mutates the prior state', () => {
    const s0 = createBattle([scroll('ab')], 5);
    const frozen = JSON.parse(JSON.stringify(s0));
    feedKey(s0, 'a', 0);
    expect(s0).toEqual(frozen);
  });

  it('stamps startedAtMs on the first strike only', () => {
    let s = createBattle([scroll('abc')], 5);
    s = feedKey(s, 'a', 1000);
    s = feedKey(s, 'b', 2000);
    expect(s.startedAtMs).toBe(1000);
    expect(s.lastKeystrokeAtMs).toBe(2000);
    expect(elapsedMs(s)).toBe(1000);
  });
});

describe('battleResult', () => {
  it('computes 50 wpm for 25 correct chars in 6 seconds', () => {
    const text = 'a'.repeat(25);
    let s = createBattle([scroll(text)], 30);
    s = typeItTrue(s, text, 0, 6000);
    const r = battleResult(s);
    expect(r.durationMs).toBe(6000);
    expect(r.wpm).toBe(50); // (25 / 5) / (6000 / 60000 min)
    expect(r.accuracy).toBe(1);
    expect(r.keystrokes).toBe(25);
    expect(r.mistakes).toBe(0);
  });

  it('computes accuracy as correct / total strikes', () => {
    let s = createBattle([scroll('abcd')], 10);
    s = feedKey(s, 'a', 0);
    s = feedKey(s, 'X', 100); // fumble
    s = feedKey(s, 'c', 200);
    s = feedKey(s, 'd', 300);
    const r = battleResult(s);
    expect(r.accuracy).toBe(0.75); // 3 of 4
    expect(r.mistakes).toBe(1);
    expect(r.keystrokes).toBe(4);
  });

  it('normalizes damage to the dragon and pegs xp to raw performance', () => {
    // Two scrolls of 10 chars each; 20 strikes over 12s, 16 of them clean.
    let s = createBattle([scroll('aaaaaaaaaa'), scroll('bbbbbbbbbb')], 20);
    const strikes = 'aaaaXaaaXabbbbXbbbXb'; // 4 fumbles among 20
    for (let i = 0; i < strikes.length; i++) {
      s = feedKey(s, strikes[i]!, Math.round((i * 12000) / 19));
    }
    expect(s.finished).toBe(true);
    const r = battleResult(s);
    // wpm = (16 / 5) / 0.2 min = 16; accuracy = 16/20 = 0.8
    expect(r.wpm).toBeCloseTo(16, 10);
    expect(r.accuracy).toBe(0.8);
    // rawPower = 16 × 0.8² = 10.24; skillFactor = 10.24 / 60 ≈ 0.1707
    // damage = round(0.1707 × 20 hp) = 3
    expect(r.damage).toBe(Math.round((16 * 0.8 * 0.8 * 20) / 60));
    expect(r.damage).toBe(3);
    // xp = round(rawPower × 2 scrolls × (0.5 + 0.8/2)) = round(18.432) = 18
    expect(r.xpEarned).toBe(Math.round(16 * 0.8 * 0.8 * 2 * (0.5 + 0.8 / 2)));
    expect(r.xpEarned).toBe(18);
  });

  // Crafting exact wpm/accuracy through feedKey is fiddly; battleResult is a
  // pure function of the state ledger, so these forge the ledger directly.
  const forgedState = (opts: {
    correctChars: number;
    keystrokes: number;
    durationMs: number;
    dragonHp: number;
    snippets: number;
  }): BattleState => ({
    ...createBattle(
      Array.from({ length: opts.snippets }, () => scroll('x')),
      opts.dragonHp,
    ),
    correctChars: opts.correctChars,
    keystrokes: opts.keystrokes,
    mistakes: opts.keystrokes - opts.correctChars,
    startedAtMs: 0,
    lastKeystrokeAtMs: opts.durationMs,
    finished: true,
  });

  it("the playtester's pace (~30 wpm, 82%) carves 35-50% of a small dragon over 2-3 battles", () => {
    // 205 clean of 250 strikes in 82s → wpm = 41/1.3667 = 30, accuracy = 0.82
    const s = forgedState({
      correctChars: 205,
      keystrokes: 250,
      durationMs: 82_000,
      dragonHp: 11,
      snippets: 5,
    });
    const r = battleResult(s);
    expect(r.wpm).toBeCloseTo(30, 6);
    expect(r.accuracy).toBeCloseTo(0.82, 10);
    // skillFactor = 30 × 0.82² / 60 ≈ 0.336 → damage = round(0.336 × 11) = 4
    expect(r.damage).toBe(4);
    expect(r.damage / 11).toBeGreaterThanOrEqual(0.35);
    expect(r.damage / 11).toBeLessThanOrEqual(0.5);
    // xp keeps its old magnitude (~92 at this pace), not the dragon-sized damage
    expect(r.xpEarned).toBe(92);
  });

  it('caps even a legendary duel at half the dragon, and floors a feeble one', () => {
    // 120 wpm flawless: skillFactor 2.0 → clamped to 0.5 → half of 30 hp
    const legend = battleResult(
      forgedState({ correctChars: 200, keystrokes: 200, durationMs: 20_000, dragonHp: 30, snippets: 5 }),
    );
    expect(legend.wpm).toBe(120);
    expect(legend.damage).toBe(15);

    // 5 wpm at 50%: skillFactor ≈ 0.021 → clamped up to 0.05 of 30 hp ≈ 2
    const feeble = battleResult(
      forgedState({ correctChars: 50, keystrokes: 100, durationMs: 120_000, dragonHp: 30, snippets: 5 }),
    );
    expect(feeble.damage).toBe(Math.round(0.05 * 30));

    // …and never less than a single scratch, even on a 1-hp runt.
    const runt = battleResult(
      forgedState({ correctChars: 50, keystrokes: 100, durationMs: 120_000, dragonHp: 1, snippets: 5 }),
    );
    expect(runt.damage).toBe(1);
  });

  it('yields a zero-spoils result for an untouched battle', () => {
    const r = battleResult(createBattle([scroll('abc')], 5));
    expect(r).toEqual({
      wpm: 0,
      accuracy: 0,
      durationMs: 0,
      keystrokes: 0,
      mistakes: 0,
      damage: 0,
      xpEarned: 0,
    });
  });
});
