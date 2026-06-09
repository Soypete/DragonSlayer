/**
 * The Guild Board — every posted deed, now selectable. Enter pledges (or
 * renounces) a quest for FREE; on a pledged quest, F pays the guild 25 gold
 * and the squire forges a Claude skill into the target repo. The gold is
 * debited up front and refunded should the squire stay his hammer.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Box, Text } from 'ink';
import { useRealmInput } from '../useRealmInput.js';
import type { GameConfig, Quest, RepoScan, SaveGame, SkillForgeResult } from '../../types.js';
import { forgeSkill } from '../../ai/squire.js';
import {
  FORGE_SKILL_COST,
  NO_CREDIT,
  canAfford,
  isPledged,
  musterBoard,
  refundGold,
  spendGold,
} from '../../game/shop.js';
import { scrollWindow } from '../logic.js';
import { COLORS, PLEDGE_SIGIL, questColor, questSigil } from '../theme.js';
import { KeyHints } from '../components/KeyHints.js';
import { Spinner } from '../components/Spinner.js';

const WINDOW_HEIGHT = 5;

export interface QuestsScreenProps {
  save: SaveGame;
  scan: RepoScan;
  config: GameConfig;
  /** Toggle the pledge (the Keep also renounces the skill, tolerating errors). */
  onPledge: (quest: Quest) => void;
  /** Persist-and-adopt a gold mutation (forge purchase / refund). */
  onChronicle: (next: SaveGame) => void;
  onBack: () => void;
}

type Smithy =
  | { phase: 'idle'; note?: string }
  | { phase: 'forging'; quest: Quest }
  | { phase: 'forged'; quest: Quest; result: SkillForgeResult }
  | { phase: 'refused'; quest: Quest; note: string };

export function QuestsScreen({ save, scan, config, onPledge, onChronicle, onBack }: QuestsScreenProps) {
  const pledges = save.pledges ?? [];
  const board = musterBoard(save.quests, pledges);
  const [cursor, setCursor] = useState(0);
  const [smithy, setSmithy] = useState<Smithy>({ phase: 'idle' });
  const clamped = board.length === 0 ? 0 : Math.min(cursor, board.length - 1);
  const chosen = board[clamped];

  // The squire may still be hammering when the knight leaves the hall.
  const alive = useRef(true);
  useEffect(() => {
    return () => {
      alive.current = false;
    };
  }, []);

  /** Pay 25 gold and set the squire to work; refund if his hammer stays. */
  const buyForging = (quest: Quest) => {
    if (!isPledged(save, quest.id)) {
      setSmithy({ phase: 'idle', note: 'The squire forges only for sworn deeds — pledge it first (enter).' });
      return;
    }
    if (quest.status === 'complete') {
      setSmithy({ phase: 'idle', note: 'That deed is already done; the squire bows and pockets nothing.' });
      return;
    }
    if (!canAfford(save, FORGE_SKILL_COST)) {
      setSmithy({ phase: 'refused', quest, note: `${NO_CREDIT} — ${FORGE_SKILL_COST} gold for a forging, and your purse holds ${save.gold}.` });
      return;
    }
    const debited = spendGold(save, FORGE_SKILL_COST);
    onChronicle(debited);
    setSmithy({ phase: 'forging', quest });
    void forgeSkill(quest, scan, config, save.dragons).then(
      (result) => {
        if (alive.current) setSmithy({ phase: 'forged', quest, result });
      },
      (err: unknown) => {
        // The forge threw (a foreign SKILL.md blocks the path) — refund the gold.
        onChronicle(refundGold(debited, FORGE_SKILL_COST));
        if (alive.current) {
          setSmithy({ phase: 'refused', quest, note: `${err instanceof Error ? err.message : String(err)} (your ${FORGE_SKILL_COST} gold is refunded.)` });
        }
      },
    );
  };

  useRealmInput((input, key) => {
    if (smithy.phase === 'forging') return; // the anvil rings; the hall waits.
    if (smithy.phase === 'forged' || smithy.phase === 'refused') {
      if (key.return || key.escape || input === 'q') setSmithy({ phase: 'idle' });
      return;
    }
    if (key.escape || input === 'q') onBack();
    else if (key.upArrow || input === 'k') {
      setSmithy({ phase: 'idle' });
      setCursor((clamped + Math.max(1, board.length) - 1) % Math.max(1, board.length));
    } else if (key.downArrow || input === 'j') {
      setSmithy({ phase: 'idle' });
      setCursor((clamped + 1) % Math.max(1, board.length));
    } else if (key.return) {
      if (chosen) {
        setSmithy({ phase: 'idle' });
        onPledge(chosen);
      }
    } else if (input === 'F') {
      if (chosen) buyForging(chosen);
    }
  });

  const [start, end] = scrollWindow(board.length, clamped, WINDOW_HEIGHT);
  const forgeable = chosen !== undefined && isPledged(save, chosen.id) && chosen.status !== 'complete';

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text>
        <Text color={COLORS.gold}>📜 The Guild Board</Text>
        <Text color={COLORS.steel}>  ·  </Text>
        <Text color={COLORS.gold}>⛁ {save.gold} gold</Text>
      </Text>
      <Text color={COLORS.parchment} wrap="wrap">
        quests track themselves — objectives update when you forge; enter pledges. A pledge is
        free; {PLEDGE_SIGIL} marks the sworn, and the squire will forge a Claude skill for any of them.
      </Text>
      {board.length === 0 ? (
        <Text color={COLORS.parchment}>The board is bare. Forge a scan and deeds will be posted.</Text>
      ) : (
        <Box flexDirection="column">
          {start > 0 ? <Text color={COLORS.parchment}>  … {start} deeds above …</Text> : null}
          {board.slice(start, end).map((quest, i) => (
            <QuestRow
              key={quest.id}
              quest={quest}
              pledged={isPledged(save, quest.id)}
              chosen={start + i === clamped}
            />
          ))}
          {end < board.length ? (
            <Text color={COLORS.parchment}>  … {board.length - end} deeds below …</Text>
          ) : null}
        </Box>
      )}

      <SmithyReport smithy={smithy} />

      {smithy.phase === 'forged' || smithy.phase === 'refused' ? (
        <KeyHints hints={[{ key: 'enter / esc', does: 'back to the board' }]} />
      ) : (
        <KeyHints
          hints={[
            { key: 'j/k ↑↓', does: 'roam' },
            { key: 'enter', does: chosen && isPledged(save, chosen.id) ? 'renounce the pledge' : 'pledge (free)' },
            ...(forgeable ? [{ key: 'F', does: `Forge a Claude skill — ${FORGE_SKILL_COST} gold` }] : []),
            { key: 'esc / q', does: 'back to the realm map' },
          ]}
        />
      )}
    </Box>
  );
}

/** The anvil's verdicts: spinner, triumph, or a kindly refusal. */
function SmithyReport({ smithy }: { smithy: Smithy }) {
  if (smithy.phase === 'idle') {
    return smithy.note ? (
      <Box marginTop={1}>
        <Text color={COLORS.torch} wrap="wrap">{smithy.note}</Text>
      </Box>
    ) : null;
  }
  if (smithy.phase === 'forging') {
    return (
      <Box marginTop={1} flexDirection="column">
        <Spinner label={`The squire heats the anvil for “${smithy.quest.title}”…`} />
        <Text color={COLORS.parchment}>claude tailors the skill — up to 30s; the template stands in if the seer is silent.</Text>
      </Box>
    );
  }
  if (smithy.phase === 'forged') {
    return (
      <Box marginTop={1} borderStyle="round" borderColor={COLORS.verdant} paddingX={1} flexDirection="column">
        <Text color={COLORS.verdant}>⚒ The skill is forged! Your coding sessions now know the quest.</Text>
        <Text color={COLORS.steel}>{smithy.result.path}</Text>
        <Text color={COLORS.parchment}>
          (tailored by: {smithy.result.source === 'claude' ? 'the true seer' : 'the deterministic template'})
        </Text>
      </Box>
    );
  }
  return (
    <Box marginTop={1} borderStyle="round" borderColor={COLORS.torch} paddingX={1} flexDirection="column">
      <Text color={COLORS.torch}>The squire stays his hammer.</Text>
      <Text color={COLORS.steel} wrap="wrap">{smithy.note}</Text>
    </Box>
  );
}

function QuestRow({ quest, pledged, chosen }: { quest: Quest; pledged: boolean; chosen: boolean }) {
  const color = questColor(quest.status);
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>
        <Text color={chosen ? COLORS.gold : COLORS.steel}>{chosen ? '❯ ' : '  '}</Text>
        {pledged ? <Text color={COLORS.banner}>{PLEDGE_SIGIL} </Text> : null}
        <Text color={color}>{questSigil(quest.status)} {quest.title}</Text>
        <Text color={COLORS.parchment}> [{quest.kind}] </Text>
        <Text color={COLORS.gold}>+{quest.xpReward} XP</Text>
        {pledged ? <Text color={COLORS.banner}> — sworn</Text> : null}
      </Text>
      <Text color={COLORS.steel}>    {quest.description}</Text>
      {quest.objectives
        .filter((o) => !o.id.startsWith('tdd:baseline:'))
        .map((obj) => (
          <Text key={obj.id} color={obj.done ? COLORS.verdant : COLORS.parchment}>
            {'      '}
            {obj.done ? '☑' : '☐'} {obj.description}
          </Text>
        ))}
    </Box>
  );
}
