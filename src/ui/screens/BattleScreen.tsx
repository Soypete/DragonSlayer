/**
 * The Typing Battle — transcribe the dragon's own scrolls faster and cleaner
 * than it can burn them. The engine is pure; this screen feeds it keystrokes
 * and wall-clock timestamps (the engine never reads the clock itself).
 */

import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { useRealmInput } from '../useRealmInput.js';
import { join } from 'node:path';
import type { BattleResult, Dragon } from '../../types.js';
import {
  type BattleState,
  WITHDRAW_KEY,
  battleResult,
  createBattle,
  currentSnippet,
  elapsedMs,
  feedKey,
} from '../../typing/engine.js';
import { snippetsFromFile } from '../../typing/snippets.js';
import { COLORS, formatDuration, formatPct, hpBar, hpColor } from '../theme.js';
import { padSnippets, SCROLLS_PER_BATTLE } from '../logic.js';
import { KeyHints } from '../components/KeyHints.js';
import { Spinner } from '../components/Spinner.js';

export interface BattleScreenProps {
  dragon: Dragon;
  repoPath: string;
  /** Called once with the spoils the moment the last scroll is finished. */
  onSpoils: (dragonId: string, result: BattleResult) => void;
  /** Leave the battlefield (after the summary, or fleeing mid-fight). */
  onLeave: () => void;
}

export function BattleScreen({ dragon, repoPath, onSpoils, onLeave }: BattleScreenProps) {
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [spoils, setSpoils] = useState<BattleResult | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let harvested = [] as Awaited<ReturnType<typeof snippetsFromFile>>;
      try {
        harvested = await snippetsFromFile(join(repoPath, dragon.file), SCROLLS_PER_BATTLE);
      } catch {
        // The lair was sealed (unreadable file) — fight with incantations alone.
      }
      if (!alive) return;
      const scrolls = padSnippets(harvested, dragon.file, SCROLLS_PER_BATTLE);
      setBattle(createBattle(scrolls, dragon.hp));
    })();
    return () => {
      alive = false;
    };
    // The battle is forged once per engagement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealmInput((input, key) => {
    if (key.escape) {
      onLeave();
      return;
    }
    if (!battle) return;
    if (battle.finished) {
      if (key.return) onLeave();
      return;
    }

    const now = Date.now();
    let next = battle;
    if (key.backspace || key.delete) {
      next = feedKey(next, WITHDRAW_KEY, now);
    } else if (input && !key.ctrl && !key.meta && !key.upArrow && !key.downArrow && !key.leftArrow && !key.rightArrow && !key.tab && !key.return) {
      for (const char of input) {
        next = feedKey(next, char, now);
      }
    } else {
      return;
    }

    if (next.finished && !battle.finished) {
      const result = battleResult(next);
      setSpoils(result);
      onSpoils(dragon.id, result);
    }
    setBattle(next);
  });

  if (!battle) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Spinner label={`Unfurling the scrolls of ${dragon.file}…`} />
      </Box>
    );
  }

  if (battle.finished && spoils) {
    return <SpoilsView dragon={dragon} spoils={spoils} />;
  }

  return <FightView dragon={dragon} battle={battle} />;
}

// ── Mid-fight view ───────────────────────────────────────────────────────────

function FightView({ dragon, battle }: { dragon: Dragon; battle: BattleState }) {
  const scroll = currentSnippet(battle);
  const live = battleResult(battle);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box borderStyle="round" borderColor={COLORS.ember} paddingX={1} flexDirection="column">
        <Text>
          <Text color={COLORS.ember}>{dragon.name}</Text>
          <Text color={COLORS.parchment}> ({dragon.species}) guards </Text>
          <Text color={COLORS.steel}>{dragon.file}</Text>
        </Text>
        <Text>
          <Text color={hpColor(dragon.hp, dragon.maxHp)}>{hpBar(dragon.hp, dragon.maxHp, 24)}</Text>
          <Text color={COLORS.steel}> {dragon.hp}/{dragon.maxHp} uncovered lines</Text>
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={COLORS.parchment}>
          Scroll {battle.snippetIndex + 1} of {battle.snippets.length}
          {scroll ? ` — ${scroll.source}` : ''}
        </Text>
        {scroll ? <SnippetLine text={scroll.text} typed={battle.typed} /> : null}
      </Box>

      <Box marginTop={1}>
        <Text color={COLORS.steel}>
          WPM <Text color={COLORS.banner}>{Math.round(live.wpm)}</Text>
          {'  '}Accuracy <Text color={COLORS.banner}>{formatPct(live.accuracy * 100)}</Text>
          {'  '}Combo <Text color={battle.combo >= 10 ? COLORS.gold : COLORS.banner}>{battle.combo}×</Text>
          {'  '}Fumbles <Text color={battle.mistakes > 0 ? COLORS.ember : COLORS.verdant}>{battle.mistakes}</Text>
          {'  '}Elapsed <Text color={COLORS.banner}>{formatDuration(elapsedMs(battle))}</Text>
        </Text>
      </Box>

      <KeyHints
        hints={[
          { key: 'type', does: 'strike' },
          { key: 'backspace', does: 'withdraw a rune' },
          { key: 'esc', does: 'flee (no spoils)' },
        ]}
      />
    </Box>
  );
}

/** The scroll under the quill: clean strikes green, fumbles red, the rest dim. */
function SnippetLine({ text, typed }: { text: string; typed: BattleState['typed'] }) {
  const chars = [...text];
  return (
    <Text>
      {typed.map((rune, i) => (
        <Text
          key={i}
          color={rune.correct ? COLORS.verdant : undefined}
          backgroundColor={rune.correct ? undefined : COLORS.ember}
        >
          {rune.expected === ' ' && !rune.correct ? '·' : rune.expected}
        </Text>
      ))}
      {typed.length < chars.length ? (
        <Text inverse color={COLORS.banner}>{chars[typed.length]}</Text>
      ) : null}
      <Text color={COLORS.parchment}>{chars.slice(typed.length + 1).join('')}</Text>
    </Text>
  );
}

// ── End-of-battle spoils ─────────────────────────────────────────────────────

function SpoilsView({ dragon, spoils }: { dragon: Dragon; spoils: BattleResult }) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box borderStyle="double" borderColor={COLORS.gold} paddingX={1} flexDirection="column">
        <Text color={COLORS.gold}>⚔ The scrolls are transcribed — {dragon.name} reels!</Text>
        <Text color={COLORS.steel}>
          Damage <Text color={COLORS.ember}>{spoils.damage}</Text>
          {'  '}XP <Text color={COLORS.gold}>+{spoils.xpEarned}</Text>
          {'  '}WPM <Text color={COLORS.banner}>{Math.round(spoils.wpm)}</Text>
          {'  '}Accuracy <Text color={COLORS.banner}>{formatPct(spoils.accuracy * 100)}</Text>
        </Text>
        <Text color={COLORS.steel}>
          {spoils.keystrokes} strikes, {spoils.mistakes} fumbles, {formatDuration(spoils.durationMs)} in the lists.
        </Text>
        <Text color={COLORS.parchment}>
          Typing only weakens the beast — only the Forge (real coverage) can slay it.
        </Text>
      </Box>
      <KeyHints hints={[{ key: 'enter', does: 'back to the realm map' }, { key: 'esc', does: 'back' }]} />
    </Box>
  );
}
