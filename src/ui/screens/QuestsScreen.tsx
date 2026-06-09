/** The Guild Board — every posted deed and its objectives. */

import React from 'react';
import { Box, Text } from 'ink';
import { useRealmInput } from '../useRealmInput.js';
import type { Quest } from '../../types.js';
import { COLORS, questColor, questSigil } from '../theme.js';
import { KeyHints } from '../components/KeyHints.js';

export interface QuestsScreenProps {
  quests: Quest[];
  onBack: () => void;
}

const KIND_ORDER: Record<Quest['kind'], number> = {
  slay: 0,
  coverage: 1,
  tdd: 2,
  ci: 3,
  e2e: 4,
  oracle: 5,
};

export function QuestsScreen({ quests, onBack }: QuestsScreenProps) {
  useRealmInput((input, key) => {
    if (key.escape || input === 'q' || key.return) onBack();
  });

  const board = [...quests].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'complete' ? 1 : -1;
    if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    return a.id.localeCompare(b.id);
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color={COLORS.gold}>📜 The Guild Board</Text>
      {board.length === 0 ? (
        <Text color={COLORS.parchment}>The board is bare. Forge a scan and deeds will be posted.</Text>
      ) : (
        board.map((quest) => <QuestRow key={quest.id} quest={quest} />)
      )}
      <KeyHints hints={[{ key: 'esc / q', does: 'back to the realm map' }]} />
    </Box>
  );
}

function QuestRow({ quest }: { quest: Quest }) {
  const color = questColor(quest.status);
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>
        <Text color={color}>{questSigil(quest.status)} {quest.title}</Text>
        <Text color={COLORS.parchment}> [{quest.kind}] </Text>
        <Text color={COLORS.gold}>+{quest.xpReward} XP</Text>
      </Text>
      <Text color={COLORS.steel}>  {quest.description}</Text>
      {quest.objectives
        .filter((o) => !o.id.startsWith('tdd:baseline:'))
        .map((obj) => (
          <Text key={obj.id} color={obj.done ? COLORS.verdant : COLORS.parchment}>
            {'    '}
            {obj.done ? '☑' : '☐'} {obj.description}
          </Text>
        ))}
    </Box>
  );
}
