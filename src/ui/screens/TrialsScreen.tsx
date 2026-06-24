/**
 * The Sword-School — vim trials for a knight who has never held the blade.
 *
 * Flow per trial: lesson card (step the demo at your own pace) → untimed
 * practice rep → scored attempt (strokes vs par, the clock running) →
 * debrief (your keys against the par scripture, stars, XP, blade).
 *
 * All editor logic lives in the pure src/vim engine; this screen only feeds
 * it keys. The wall clock is read HERE and only here — never in pure code.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import { useRealmInput } from '../useRealmInput.js';
import type { SaveGame, TrialResult, VimBuffer, VimTrial } from '../../types.js';
import { createVimBuffer, keysFromString, playKeys, vimKey } from '../../vim/engine.js';
import { TRIALS, newVimProgress, nextTrial } from '../../vim/trials.js';
import {
  HINT_COST,
  chronicleTrial,
  debriefLine,
  forgeTrialResult,
  hintToll,
  scribeKeys,
  scrollWindow,
  starGlyphs,
  trialFulfilled,
} from '../logic.js';
import { COLORS, formatDuration } from '../theme.js';
import { VimPane } from '../components/VimPane.js';
import { KeyHints } from '../components/KeyHints.js';

const LIST_HEIGHT = 14;

/** What each tier of the school drills into the knight. */
const TIER_NAMES: Record<number, string> = {
  1: "The Squire's Footwork · h j k l x",
  2: 'Strides of the Knight · w b e 0 ^ $ gg G, counts',
  3: 'The Cutting Arts · d y p',
  4: "The Scribe's Arts · i a o, c, esc",
  5: 'Strike the Heart · text objects iw i" i( i{ · 3dd · V',
  6: "The Hunter's Arts · f t ; , / n",
  7: 'Advanced Arts · word-change clarity · { } ip ap',
  8: 'The Macro Arts · q @ @@',
};

type Phase = 'list' | 'lesson' | 'practice' | 'scored' | 'debrief';

export interface TrialsScreenProps {
  save: SaveGame;
  /** Persist-and-adopt: the Keep writes the chronicle and re-renders us. */
  onChronicle: (next: SaveGame) => void;
  onBack: () => void;
}

/** Map one Ink input event onto engine keys ('<esc>', '<cr>', '<bs>', chars). */
function toVimKeys(input: string, key: Parameters<Parameters<typeof useRealmInput>[0]>[1]): string[] {
  if (key.escape) return ['<esc>'];
  if (key.return) return ['<cr>'];
  if (key.backspace || key.delete) return ['<bs>'];
  if (key.ctrl || key.meta || key.tab) return [];
  if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) return [];
  if (!input) return [];
  return [...input];
}

export function TrialsScreen({ save, onChronicle, onBack }: TrialsScreenProps) {
  const progress = save.vim ?? newVimProgress();
  const [phase, setPhase] = useState<Phase>('list');
  const [cursor, setCursor] = useState(() => {
    const suggested = nextTrial(save.vim);
    const at = suggested ? TRIALS.findIndex((t) => t.id === suggested.id) : 0;
    return at >= 0 ? at : 0;
  });
  const [leaderG, setLeaderG] = useState(false);
  const [trial, setTrial] = useState<VimTrial | null>(null);
  const [demoStep, setDemoStep] = useState(0);
  const [buffer, setBuffer] = useState<VimBuffer | null>(null);
  const [playerKeys, setPlayerKeys] = useState<string[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [clock, setClock] = useState(0);
  const [verdict, setVerdict] = useState<TrialResult | null>(null);

  const demoKeys = useMemo(
    () => (trial ? keysFromString(trial.lesson.demoKeys) : []),
    [trial],
  );
  const demoBuffer = useMemo(() => {
    if (!trial) return null;
    // The demo plays on its own scene when one is given, so it teaches by
    // example rather than spoiling the scored task's exact keys.
    const lines = trial.lesson.demoLines ?? trial.startLines;
    const cursor = trial.lesson.demoCursor ?? trial.startCursor;
    return playKeys(createVimBuffer(lines, cursor), demoKeys.slice(0, demoStep));
  }, [trial, demoKeys, demoStep]);

  // The scored clock: wall time lives in the UI layer alone.
  useEffect(() => {
    if (phase !== 'scored' || startedAt === null) return;
    const tick = setInterval(() => setClock(Date.now() - startedAt), 250);
    return () => clearInterval(tick);
  }, [phase, startedAt]);

  const openTrial = (t: VimTrial) => {
    setTrial(t);
    setDemoStep(0);
    setHintsUsed(0);
    setVerdict(null);
    setPhase('lesson');
  };

  const freshRep = (t: VimTrial) => {
    setBuffer(createVimBuffer(t.startLines, t.startCursor));
    setPlayerKeys([]);
  };

  const beginPractice = (t: VimTrial) => {
    freshRep(t);
    setPhase('practice');
  };

  const beginScored = (t: VimTrial) => {
    freshRep(t);
    setStartedAt(null);
    setClock(0);
    setPhase('scored');
  };

  /** `?` climbs the ladder: rung 1 is a free nudge, rungs 2–3 ask 5 gold. */
  const climbHintLadder = () => {
    if (hintsUsed >= 3) return;
    const toll = hintToll(hintsUsed, save.gold);
    if (toll > 0) onChronicle({ ...save, gold: save.gold - toll });
    setHintsUsed(hintsUsed + 1);
  };

  const finishScored = (t: VimTrial, keys: string[], begun: number) => {
    // One clock-read at the finish: it both ends the duration and dates the run.
    const completedAt = Date.now();
    const result = forgeTrialResult(t, keys.length, hintsUsed, completedAt - begun, completedAt);
    setVerdict(result);
    setPlayerKeys(keys);
    onChronicle(chronicleTrial(save, result));
    setPhase('debrief');
  };

  useRealmInput((input, key) => {
    // ── Trial roster ─────────────────────────────────────────────────────────
    if (phase === 'list') {
      if (input === 'g') {
        if (leaderG) {
          setCursor(0);
          setLeaderG(false);
        } else setLeaderG(true);
        return;
      }
      setLeaderG(false);
      if (key.escape || input === 'q') onBack();
      else if (key.upArrow || input === 'k') setCursor((c) => (c + TRIALS.length - 1) % TRIALS.length);
      else if (key.downArrow || input === 'j') setCursor((c) => (c + 1) % TRIALS.length);
      else if (input === 'G') setCursor(TRIALS.length - 1);
      else if (key.return) {
        const chosen = TRIALS[cursor];
        if (chosen && chosen.tier <= progress.unlockedTier) openTrial(chosen);
      }
      return;
    }

    if (!trial) return;

    // ── Lesson card ──────────────────────────────────────────────────────────
    if (phase === 'lesson') {
      if (key.escape || input === 'q') setPhase('list');
      else if (key.return) beginPractice(trial);
      else if (input === ' ') setDemoStep((s) => (s >= demoKeys.length ? 0 : s + 1));
      return;
    }

    // ── Debrief ──────────────────────────────────────────────────────────────
    if (phase === 'debrief') {
      if (key.return || key.escape || input === 'q') setPhase('list');
      else if (input === 'n') {
        const onward = nextTrial(save.vim);
        if (onward) openTrial(onward);
      }
      return;
    }

    // ── Practice & scored reps: the keys belong to the blade ────────────────
    if (!buffer) return;
    const fulfilled = trialFulfilled(buffer, trial.goal);
    const atRest =
      buffer.mode === 'normal' && buffer.pendingOperator === null && buffer.pendingCount === null;

    if (fulfilled && key.return) {
      // Practice rep complete — the scored attempt awaits. (A scored rep
      // never lingers fulfilled; it debriefs the instant the goal is met.)
      if (phase === 'practice') beginScored(trial);
      return;
    }
    if (atRest && input === '?') {
      climbHintLadder();
      return;
    }
    if (atRest && key.escape) {
      // Esc abandons the rep when nothing is pending. (q is left for the blade —
      // the macro arts record with q, so it must reach the engine.)
      setPhase('list');
      return;
    }
    if (phase === 'practice' && atRest && input === 'r') {
      freshRep(trial);
      return;
    }

    const keys = toVimKeys(input, key);
    if (keys.length === 0) return;

    let b = buffer;
    const pressed: string[] = [];
    for (const k of keys) {
      b = vimKey(b, k).buffer;
      pressed.push(k);
      if (phase === 'scored' && trialFulfilled(b, trial.goal)) break;
    }
    const allKeys = [...playerKeys, ...pressed];
    setBuffer(b);
    setPlayerKeys(allKeys);

    if (phase === 'scored') {
      const begun = startedAt ?? Date.now();
      if (startedAt === null) setStartedAt(begun);
      if (trialFulfilled(b, trial.goal)) finishScored(trial, allKeys, begun);
    }
  });

  if (phase === 'list') {
    return <RosterView save={save} unlockedTier={progress.unlockedTier} cursor={cursor} />;
  }
  if (!trial) return null;
  if (phase === 'lesson') {
    return (
      <LessonView trial={trial} demoBuffer={demoBuffer} demoKeys={demoKeys} demoStep={demoStep} />
    );
  }
  if (phase === 'debrief' && verdict) {
    return <DebriefView trial={trial} verdict={verdict} playerKeys={playerKeys} />;
  }
  if (!buffer) return null;
  return (
    <RepView
      trial={trial}
      buffer={buffer}
      scored={phase === 'scored'}
      keystrokes={playerKeys.length}
      clock={clock}
      hintsUsed={hintsUsed}
      gold={save.gold}
    />
  );
}

// ── The roster: every trial, grouped by tier, stars and gates ────────────────

function RosterView({
  save,
  unlockedTier,
  cursor,
}: {
  save: SaveGame;
  unlockedTier: number;
  cursor: number;
}) {
  const progress = save.vim ?? newVimProgress();
  const [start, end] = scrollWindow(TRIALS.length, cursor, LIST_HEIGHT);
  const visible = TRIALS.slice(start, end);

  const totalStars = TRIALS.reduce((sum, t) => sum + (progress.results[t.id]?.stars ?? 0), 0);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color={COLORS.gold}>⚔ The Sword-School — vim trials of the realm</Text>
      <Text color={COLORS.steel}>
        Tier <Text color={COLORS.banner}>{unlockedTier}</Text> of 8 unlocked · {totalStars}/
        {TRIALS.length * 3} stars · <Text color={COLORS.gold}>⛁ {save.gold} gold</Text>
        {progress.bladeBuff > 1 ? (
          <Text color={COLORS.torch}>
            {'  '}· blade ×{progress.bladeBuff.toFixed(1)} awaits the next battle
          </Text>
        ) : null}
      </Text>
      <Text color={COLORS.parchment}>
        Earn 2★ on three trials of a tier to fling open the next gate.
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {start > 0 ? <Text color={COLORS.parchment}>  … {start} trials above …</Text> : null}
        {visible.map((trial, i) => {
          const index = start + i;
          const prev = visible[i - 1];
          const showHeader = i === 0 || prev?.tier !== trial.tier;
          const locked = trial.tier > unlockedTier;
          return (
            <Box key={trial.id} flexDirection="column">
              {showHeader ? (
                <Text color={locked ? COLORS.parchment : COLORS.arcana}>
                  {locked ? '🔒' : '◈'} Tier {trial.tier} — {TIER_NAMES[trial.tier]}
                </Text>
              ) : null}
              <TrialRow
                trial={trial}
                stars={progress.results[trial.id]?.stars ?? 0}
                locked={locked}
                chosen={index === cursor}
              />
            </Box>
          );
        })}
        {end < TRIALS.length ? (
          <Text color={COLORS.parchment}>  … {TRIALS.length - end} trials below …</Text>
        ) : null}
      </Box>
      <KeyHints
        hints={[
          { key: 'j/k ↑↓', does: 'roam' },
          { key: 'gg/G', does: 'top/bottom' },
          { key: 'enter', does: 'take the trial' },
          { key: 'esc', does: 'realm map' },
        ]}
      />
    </Box>
  );
}

function TrialRow({
  trial,
  stars,
  locked,
  chosen,
}: {
  trial: VimTrial;
  stars: number;
  locked: boolean;
  chosen: boolean;
}) {
  if (locked) {
    return (
      <Text color={COLORS.parchment} dimColor={!chosen}>
        {chosen ? '❯ ' : '  '}
        {starGlyphs(stars)} {trial.title} — sealed until the gate opens
      </Text>
    );
  }
  return (
    <Text>
      <Text color={stars > 0 ? COLORS.gold : COLORS.parchment}>
        {chosen ? '❯ ' : '  '}
        {starGlyphs(stars)}
      </Text>
      <Text color={chosen ? COLORS.gold : COLORS.steel}> {trial.title}</Text>
      <Text color={COLORS.parchment}>
        {' '}· teaches {trial.keysTaught.join(' ')} · par {trial.par}
      </Text>
    </Text>
  );
}

// ── The lesson card: teach first, then let them swing ───────────────────────

function LessonView({
  trial,
  demoBuffer,
  demoKeys,
  demoStep,
}: {
  trial: VimTrial;
  demoBuffer: VimBuffer | null;
  demoKeys: string[];
  demoStep: number;
}) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color={COLORS.gold}>
        ⚔ Tier {trial.tier} · {trial.title}
      </Text>
      <Box borderStyle="round" borderColor={COLORS.arcana} paddingX={1} flexDirection="column" marginTop={1}>
        <Text color={COLORS.arcana}>{trial.lesson.heading}</Text>
        <Text color={COLORS.steel} wrap="wrap">
          {trial.lesson.body}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={COLORS.parchment}>
          The masters do it in <Text color={COLORS.gold}>{trial.par}</Text> keystrokes. Watch the
          demo, one key per press of space:
        </Text>
        <Text>
          <Text color={COLORS.steel}>Demo </Text>
          {demoKeys.map((k, i) => (
            <Text
              key={`${i}-${k}`}
              color={i < demoStep ? COLORS.verdant : COLORS.parchment}
              inverse={i === demoStep}
            >
              {k}
            </Text>
          ))}
          <Text color={COLORS.parchment}>
            {'  '}({Math.min(demoStep, demoKeys.length)}/{demoKeys.length} played)
          </Text>
        </Text>
      </Box>
      {demoBuffer ? (
        <Box marginTop={1} flexDirection="column">
          <VimPane buffer={demoBuffer} />
        </Box>
      ) : null}
      <GoalCard trial={trial} />
      <KeyHints
        hints={[
          { key: 'space', does: 'step the demo' },
          { key: 'enter', does: 'practice rep (untimed)' },
          { key: 'esc', does: 'trial roster' },
        ]}
      />
    </Box>
  );
}

/** Spell out what "done" means, in words a novice can check for themselves. */
function GoalCard({ trial }: { trial: VimTrial }) {
  if (trial.goal.kind === 'cursor') {
    return (
      <Box marginTop={1}>
        <Text color={COLORS.torch}>
          Goal: rest the cursor on line {trial.goal.row + 1}, column {trial.goal.col + 1}.
        </Text>
      </Box>
    );
  }
  return (
    <Box marginTop={1} flexDirection="column">
      <Text color={COLORS.torch}>Goal: the scroll must read exactly —</Text>
      <Box borderStyle="round" borderColor={COLORS.torch} paddingX={1} flexDirection="column">
        {trial.goal.lines.map((line, i) => (
          <Text key={i} color={COLORS.steel}>
            {line.length > 0 ? line : ' '}
          </Text>
        ))}
      </Box>
    </Box>
  );
}

// ── Practice & scored reps ───────────────────────────────────────────────────

function RepView({
  trial,
  buffer,
  scored,
  keystrokes,
  clock,
  hintsUsed,
  gold,
}: {
  trial: VimTrial;
  buffer: VimBuffer;
  scored: boolean;
  keystrokes: number;
  clock: number;
  hintsUsed: number;
  gold: number;
}) {
  const fulfilled = trialFulfilled(buffer, trial.goal);
  const strokeColor =
    keystrokes <= trial.par ? COLORS.gold : keystrokes <= trial.par * 2 ? COLORS.torch : COLORS.ember;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color={COLORS.gold}>
        ⚔ Tier {trial.tier} · {trial.title} —{' '}
        {scored ? <Text color={COLORS.ember}>SCORED ATTEMPT</Text> : <Text color={COLORS.verdant}>practice rep (untimed)</Text>}
      </Text>
      {scored ? (
        <Text color={COLORS.steel}>
          Strokes <Text color={strokeColor}>{keystrokes}</Text> / par{' '}
          <Text color={COLORS.gold}>{trial.par}</Text>
          {'   '}Clock <Text color={COLORS.banner}>{formatDuration(clock)}</Text>
          <Text color={COLORS.parchment}> (starts on your first key)</Text>
        </Text>
      ) : (
        <Text color={COLORS.parchment}>
          No clock, no count — swing freely. Par is {trial.par} keystrokes.
        </Text>
      )}
      <Box marginTop={1} flexDirection="column">
        <VimPane buffer={buffer} />
      </Box>
      <GoalCard trial={trial} />
      {fulfilled && !scored ? (
        <Box marginTop={1}>
          <Text color={COLORS.verdant}>
            ✓ The goal is met! Press enter to face the scored attempt.
          </Text>
        </Box>
      ) : null}
      <HintLadder trial={trial} hintsUsed={hintsUsed} gold={gold} />
      <KeyHints
        hints={[
          { key: '?', does: `hint (rungs 2–3 cost ${HINT_COST} gold)` },
          ...(scored ? [] : [{ key: 'r', does: 'restart the rep' }]),
          { key: 'esc', does: scored ? 'abandon the attempt' : 'trial roster' },
        ]}
      />
    </Box>
  );
}

/** The rungs already bought, spelled out; the next rung teased. */
function HintLadder({ trial, hintsUsed, gold }: { trial: VimTrial; hintsUsed: number; gold: number }) {
  if (hintsUsed === 0) {
    return (
      <Box marginTop={1}>
        <Text color={COLORS.parchment}>
          Stuck? Press ? for a nudge (the first whisper is free).
        </Text>
      </Box>
    );
  }
  const rungNames = ['a nudge', 'the exact keys', 'the full walkthrough'];
  return (
    <Box marginTop={1} flexDirection="column">
      {trial.hints.slice(0, hintsUsed).map((hint, i) => (
        <Text key={i} color={COLORS.arcana} wrap="wrap">
          ☞ Hint {i + 1} ({rungNames[i]}): <Text color={COLORS.steel}>{hint}</Text>
        </Text>
      ))}
      {hintsUsed < 3 ? (
        <Text color={COLORS.parchment}>
          ? again for {rungNames[hintsUsed]} ({gold >= HINT_COST ? `${HINT_COST} gold` : 'the guild waives the fee — your purse is light'}).
        </Text>
      ) : null}
    </Box>
  );
}

// ── The debrief ──────────────────────────────────────────────────────────────

function DebriefView({
  trial,
  verdict,
  playerKeys,
}: {
  trial: VimTrial;
  verdict: TrialResult;
  playerKeys: string[];
}) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box borderStyle="double" borderColor={COLORS.gold} paddingX={1} flexDirection="column">
        <Text color={COLORS.gold}>
          {starGlyphs(verdict.stars)} {trial.title} — the trial stands fulfilled!
        </Text>
        <Text color={COLORS.steel}>
          Strokes <Text color={verdict.keystrokes <= verdict.par ? COLORS.gold : COLORS.torch}>{verdict.keystrokes}</Text>
          {' '}/ par <Text color={COLORS.gold}>{verdict.par}</Text>
          {'   '}Hints <Text color={verdict.hintsUsed > 0 ? COLORS.torch : COLORS.verdant}>{verdict.hintsUsed}</Text>
          {'   '}Time <Text color={COLORS.banner}>{formatDuration(verdict.durationMs)}</Text>
        </Text>
        <Text color={COLORS.steel}>
          XP <Text color={COLORS.gold}>+{verdict.xpEarned}</Text>
          {'   '}Blade{' '}
          {verdict.blade > 1 ? (
            <Text color={COLORS.torch}>×{verdict.blade.toFixed(1)} sharpened for the next battle</Text>
          ) : (
            <Text color={COLORS.parchment}>unsharpened (2★+ hones an edge)</Text>
          )}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={COLORS.parchment} wrap="wrap">
          {debriefLine(verdict.keystrokes, verdict.par, verdict.hintsUsed)}
        </Text>
        <Text>
          <Text color={COLORS.steel}>Your keys      </Text>
          <Text color={COLORS.banner}>{scribeKeys(playerKeys)}</Text>
        </Text>
        <Text>
          <Text color={COLORS.steel}>Par scripture  </Text>
          <Text color={COLORS.gold}>{trial.parSolution}</Text>
        </Text>
      </Box>
      <KeyHints
        hints={[
          { key: 'n', does: 'next trial' },
          { key: 'enter', does: 'trial roster' },
        ]}
      />
    </Box>
  );
}
