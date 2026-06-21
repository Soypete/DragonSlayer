/** The castle gates: continue an old campaign or swear a fresh oath. */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { useRealmInput } from '../useRealmInput.js';
import type { SaveGame } from '../../types.js';
import { rankForXp } from '../../game/ranks.js';
import { BANNER, COLORS } from '../theme.js';
import { KeyHints } from '../components/KeyHints.js';

export interface TitleScreenProps {
  save: SaveGame;
  /** The realm this campaign is waged in (shown under the banner). */
  repoPath?: string;
  /** True when an old chronicle was found on disk. */
  hasChronicle: boolean;
  onContinue: () => void;
  onNewQuest: () => void;
  /** Offered by the Crossroads: return to the Hall of Banners. */
  onSwitchRealm?: () => void;
}

export function TitleScreen({
  save,
  repoPath,
  hasChronicle,
  onContinue,
  onNewQuest,
  onSwitchRealm,
}: TitleScreenProps) {
  const choices = [
    ...(hasChronicle
      ? ['Continue the campaign', 'Swear a new oath (fresh save)']
      : ['Begin the campaign']),
    ...(onSwitchRealm ? ['Ride to another realm'] : []),
  ];
  const [cursor, setCursor] = useState(0);

  useRealmInput((input, key) => {
    if (key.upArrow || input === 'k') setCursor((c) => (c + choices.length - 1) % choices.length);
    else if (key.downArrow || input === 'j') setCursor((c) => (c + 1) % choices.length);
    else if (key.return || input === ' ') {
      const choice = choices[cursor];
      if (choice === 'Ride to another realm') onSwitchRealm?.();
      else if (choice === 'Swear a new oath (fresh save)') onNewQuest();
      else onContinue();
    }
  });

  const rank = rankForXp(save.xp);

  return (
    <Box flexDirection="column" paddingX={1}>
      {BANNER.map((line) => (
        <Text key={line} color={COLORS.ember}>
          {line}
        </Text>
      ))}
      <Text color={COLORS.steel}>Bugs are dragons. Coverage is the blade. 100% wins the realm.</Text>
      {repoPath ? <Text color={COLORS.parchment}>Realm: {repoPath}</Text> : null}
      <Box marginTop={1} flexDirection="column">
        {hasChronicle ? (
          <Text color={COLORS.parchment}>
            An old chronicle stirs: {rank.sigil} {rank.title}, {save.xp} XP, {save.gold} gold,{' '}
            {save.stats.dragonsSlain} dragons slain.
          </Text>
        ) : (
          <Text color={COLORS.parchment}>No chronicle found — a blank page awaits your name.</Text>
        )}
      </Box>
      <Box marginTop={1} flexDirection="column">
        {choices.map((choice, i) => (
          <Text key={choice} color={i === cursor ? COLORS.gold : COLORS.steel}>
            {i === cursor ? '❯ ' : '  '}
            {choice}
          </Text>
        ))}
      </Box>
      <KeyHints
        hints={[
          { key: '↑↓', does: 'choose' },
          { key: 'enter', does: 'ride forth' },
          { key: 'ctrl+c', does: 'abandon the realm' },
        ]}
      />
    </Box>
  );
}
