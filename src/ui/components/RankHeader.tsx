/** The knight's standard: rank, XP toward the next title, gold, coverage. */

import React from 'react';
import { Box, Text } from 'ink';
import type { SaveGame, RepoScan } from '../../types.js';
import { rankForXp, nextRank } from '../../game/ranks.js';
import { COLORS, formatPct } from '../theme.js';

export interface RankHeaderProps {
  save: SaveGame;
  scan: RepoScan;
}

export function RankHeader({ save, scan }: RankHeaderProps) {
  const rank = rankForXp(save.xp);
  const ahead = nextRank(save.xp);
  const coveragePct = scan.coverage?.totals.lines.pct ?? 0;
  const living = save.dragons.filter((d) => !d.slain).length;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={COLORS.steel} paddingX={1}>
      <Box justifyContent="space-between">
        <Text>
          <Text color={COLORS.gold}>{rank.sigil} {rank.title}</Text>
          <Text color={COLORS.steel}>
            {'  '}{save.xp} XP{ahead ? ` (${ahead.minXp - save.xp} to ${ahead.title})` : ' — the ladder is climbed'}
          </Text>
        </Text>
        <Text color={COLORS.gold}>⛁ {save.gold} gold</Text>
      </Box>
      <Box justifyContent="space-between">
        <Text color={COLORS.steel}>
          Realm coverage: <Text color={coveragePct >= 100 ? COLORS.verdant : COLORS.torch}>{formatPct(coveragePct)}</Text>
          {'   '}Dragons at large: <Text color={living > 0 ? COLORS.ember : COLORS.verdant}>{living}</Text>
          {'   '}Slain: <Text color={COLORS.verdant}>{save.stats.dragonsSlain}</Text>
        </Text>
        <Text color={COLORS.steel}>{save.repoPath}</Text>
      </Box>
    </Box>
  );
}
