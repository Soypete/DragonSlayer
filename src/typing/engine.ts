/**
 * The Battle Engine — a pure state machine for typing duels with dragons.
 *
 * No React, no clocks, no dice: every transition is a pure function of
 * (state, keystroke, timestamp). The UI feeds it keys; the engine keeps
 * the ledger of valor (correct chars), shame (mistakes), and momentum (combo).
 */

import type { BattleResult, KeystrokeResult, TypingSnippet } from '../types.js';

/** The key the engine treats as "withdraw thy blade" (backspace). */
export const WITHDRAW_KEY = '\b';

/** A single rune the knight has struck, judged against the scroll. */
export interface TypedChar {
  /** What the knight actually typed. */
  char: string;
  /** What the scroll demanded. */
  expected: string;
  /** True if the strike landed clean. */
  correct: boolean;
}

/**
 * Full battle state. The UI reads this to render the current snippet,
 * the typed-so-far runes with correctness flags, combo, and elapsed time.
 */
export interface BattleState {
  /** The scrolls (snippets) the knight must transcribe, in order. */
  snippets: TypingSnippet[];
  /** Index of the snippet currently under the quill. */
  snippetIndex: number;
  /** Runes struck so far on the CURRENT snippet. */
  typed: TypedChar[];
  /** The dragon's HP when battle began (cosmetic context for the UI). */
  dragonHp: number;
  /** Current streak of clean strikes. A single fumble resets it to 0. */
  combo: number;
  /** Longest streak achieved this battle. */
  bestCombo: number;
  /** Total clean strikes across all snippets. */
  correctChars: number;
  /** Total character strikes (withdrawals/backspaces are not counted). */
  keystrokes: number;
  /** Total fumbles across all snippets (withdrawing does not absolve them). */
  mistakes: number;
  /** Timestamp of the first strike, or null before battle is joined. */
  startedAtMs: number | null;
  /** Timestamp of the most recent strike. */
  lastKeystrokeAtMs: number | null;
  /** Verdict of the most recent strike, for the UI to flash. */
  lastKeystroke: KeystrokeResult | null;
  /** True once every snippet has been transcribed (or there were none). */
  finished: boolean;
}

/** Forge a fresh battle against a dragon guarding `dragonHp` uncovered lines. */
export function createBattle(snippets: TypingSnippet[], dragonHp: number): BattleState {
  return {
    snippets,
    snippetIndex: 0,
    typed: [],
    dragonHp,
    combo: 0,
    bestCombo: 0,
    correctChars: 0,
    keystrokes: 0,
    mistakes: 0,
    startedAtMs: null,
    lastKeystrokeAtMs: null,
    lastKeystroke: null,
    finished: snippets.length === 0,
  };
}

/** The scroll currently under the quill, or null if the battle is done. */
export function currentSnippet(state: BattleState): TypingSnippet | null {
  return state.finished ? null : (state.snippets[state.snippetIndex] ?? null);
}

/** Milliseconds between the first and most recent strike (0 before battle is joined). */
export function elapsedMs(state: BattleState): number {
  if (state.startedAtMs === null || state.lastKeystrokeAtMs === null) return 0;
  return state.lastKeystrokeAtMs - state.startedAtMs;
}

/**
 * Feed one keystroke into the battle. Pure: returns a new state, never mutates.
 *
 * - `WITHDRAW_KEY` ('\b') retracts the last rune on the current snippet.
 *   The mistake, if there was one, stays on the ledger — dragons remember.
 * - Any single character is judged against the next expected rune.
 * - Completing a snippet's final rune advances to the next scroll.
 * - Keys fed after the battle is finished, or multi-char strings, are ignored.
 */
export function feedKey(state: BattleState, char: string, timestampMs: number): BattleState {
  if (state.finished) return state;

  if (char === WITHDRAW_KEY) {
    if (state.typed.length === 0) return state;
    return { ...state, typed: state.typed.slice(0, -1) };
  }

  if (char.length !== 1) return state;

  const snippet = state.snippets[state.snippetIndex];
  if (!snippet) return state; // defensive: should be unreachable while !finished

  const expected = snippet.text[state.typed.length] ?? '';
  const correct = char === expected;
  const typed = [...state.typed, { char, expected, correct }];

  const snippetDone = typed.length >= snippet.text.length;
  const lastScrollSealed = snippetDone && state.snippetIndex >= state.snippets.length - 1;
  const combo = correct ? state.combo + 1 : 0;

  return {
    ...state,
    snippetIndex: snippetDone && !lastScrollSealed ? state.snippetIndex + 1 : state.snippetIndex,
    typed: snippetDone ? (lastScrollSealed ? typed : []) : typed,
    combo,
    bestCombo: Math.max(state.bestCombo, combo),
    correctChars: state.correctChars + (correct ? 1 : 0),
    keystrokes: state.keystrokes + 1,
    mistakes: state.mistakes + (correct ? 0 : 1),
    startedAtMs: state.startedAtMs ?? timestampMs,
    lastKeystrokeAtMs: timestampMs,
    lastKeystroke: { correct, finished: snippetDone },
    finished: lastScrollSealed,
  };
}

/**
 * Tally the spoils of battle.
 *
 * - wpm      = (correct chars / 5) / minutes elapsed
 * - accuracy = correct chars / total character keystrokes (0..1)
 * - damage   = round(wpm × accuracy² × snippetCount) — sloppy speed cuts no scales
 * - xp       = round(damage × (0.5 + accuracy / 2))
 */
export function battleResult(state: BattleState): BattleResult {
  const durationMs = elapsedMs(state);
  const minutes = durationMs / 60_000;
  const wpm = minutes > 0 ? state.correctChars / 5 / minutes : 0;
  const accuracy = state.keystrokes > 0 ? state.correctChars / state.keystrokes : 0;
  const damage = Math.round(wpm * accuracy * accuracy * state.snippets.length);
  const xpEarned = Math.round(damage * (0.5 + accuracy / 2));

  return {
    wpm,
    accuracy,
    durationMs,
    keystrokes: state.keystrokes,
    mistakes: state.mistakes,
    damage,
    xpEarned,
  };
}
