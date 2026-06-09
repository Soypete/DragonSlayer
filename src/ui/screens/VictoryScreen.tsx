/** The Victory Hall — 100% coverage, a standing e2e patrol, a realm at peace. */

import React from 'react';
import { Box, Text, useApp } from 'ink';
import { useRealmInput } from '../useRealmInput.js';
import type { SaveGame } from '../../types.js';
import { rankForXp } from '../../game/ranks.js';
import { COLORS, formatPct } from '../theme.js';
import { KeyHints } from '../components/KeyHints.js';

export interface VictoryScreenProps {
  save: SaveGame;
  onBackToMap: () => void;
}

export function VictoryScreen({ save, onBackToMap }: VictoryScreenProps) {
  const { exit } = useApp();
  const rank = rankForXp(save.xp);

  useRealmInput((input, key) => {
    if (input === 'q' || key.escape) exit();
    else if (key.return || input === 'm') onBackToMap();
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box borderStyle="double" borderColor={COLORS.gold} paddingX={2} flexDirection="column">
        <Text color={COLORS.gold}>👑  THE REALM IS WON  👑</Text>
        <Text color={COLORS.verdant}>
          Every line lies covered. The end-to-end patrol walks the walls. No dragon stirs.
        </Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text color={COLORS.steel}>
          {rank.sigil} {rank.title} — <Text color={COLORS.gold}>{save.xp} XP</Text>, <Text color={COLORS.gold}>{save.gold} gold</Text>
        </Text>
        <Text color={COLORS.steel}>
          Dragons slain: <Text color={COLORS.verdant}>{save.stats.dragonsSlain}</Text>
          {'   '}Battles fought: {save.stats.battles}
          {'   '}Best WPM: {Math.round(save.stats.bestWpm)}
          {'   '}Best accuracy: {formatPct(save.stats.bestAccuracy * 100)}
        </Text>
        <Text color={COLORS.parchment}>
          The bards will sing of {save.repoPath} for a hundred releases.
        </Text>
      </Box>
      <KeyHints
        hints={[
          { key: 'q / esc', does: 'hang up the sword' },
          { key: 'enter', does: 'wander the peaceful realm' },
        ]}
      />
    </Box>
  );
}
