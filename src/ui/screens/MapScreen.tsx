/** The Realm Map — every lair, every dragon, every wound-gauge. */

import React, { useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import { useRealmInput } from '../useRealmInput.js';
import type { Dragon, RepoScan, SaveGame } from '../../types.js';
import { COLORS, PLEDGE_SIGIL, auguryColor, augurySigil, formatPct, hpBar, hpColor, speciesSigil } from '../theme.js';
import { armoryWarnings, musterRoster, pledgeBanner, scrollWindow } from '../logic.js';
import { RankHeader } from '../components/RankHeader.js';
import { KeyHints } from '../components/KeyHints.js';

const WINDOW_HEIGHT = 12;

export interface MapScreenProps {
  save: SaveGame;
  scan: RepoScan;
  /** Local calendar day, YYYY-MM-DD — read from the clock in the Keep. */
  today: string;
  onEngage: (dragon: Dragon) => void;
  onQuests: () => void;
  onOracle: () => void;
  onForge: () => void;
  onE2e: () => void;
  onTrials: () => void;
  onShop: () => void;
}

export function MapScreen({ save, scan, today, onEngage, onQuests, onOracle, onForge, onE2e, onTrials, onShop }: MapScreenProps) {
  const roster = useMemo(() => musterRoster(save.dragons), [save.dragons]);
  const [cursor, setCursor] = useState(0);
  const [leaderG, setLeaderG] = useState(false);
  const clamped = roster.length === 0 ? 0 : Math.min(cursor, roster.length - 1);

  useRealmInput((input, key) => {
    // gg leaps to the first lair, k9s-style: a lone g waits for its twin.
    if (input === 'g') {
      if (leaderG) {
        setCursor(0);
        setLeaderG(false);
      } else setLeaderG(true);
      return;
    }
    setLeaderG(false);
    if (key.upArrow || input === 'k') setCursor(() => (clamped + roster.length - 1) % Math.max(1, roster.length));
    else if (key.downArrow || input === 'j') setCursor(() => (clamped + 1) % Math.max(1, roster.length));
    else if (input === 'G') setCursor(Math.max(0, roster.length - 1));
    else if (key.return) {
      const chosen = roster[clamped];
      if (chosen && !chosen.slain) onEngage(chosen);
    } else if (input === 'q') onQuests();
    else if (input === 'o') onOracle();
    else if (input === 'f') onForge();
    else if (input === 'e') onE2e();
    else if (input === 'v') onTrials();
    else if (input === 's') onShop();
  });

  // Standing reminders under the banner: sworn pledges and the day's augury.
  const sworn = pledgeBanner(save.quests, save.pledges ?? []);
  const augury = save.augury?.date === today ? save.augury : undefined;

  const [start, end] = scrollWindow(roster.length, clamped, WINDOW_HEIGHT);

  const bareRacks = armoryWarnings(scan.missingTools ?? []);

  return (
    <Box flexDirection="column" paddingX={1}>
      <RankHeader save={save} scan={scan} />
      {bareRacks.map((warning) => (
        <Text key={warning} color={COLORS.torch}>
          ⚒ {warning}
        </Text>
      ))}
      {sworn || augury ? (
        <Text>
          {sworn ? (
            <Text color={COLORS.banner}>
              {PLEDGE_SIGIL} {sworn}
            </Text>
          ) : null}
          {sworn && augury ? <Text color={COLORS.steel}>   </Text> : null}
          {augury ? (
            <Text color={auguryColor(augury.kind)}>
              {augurySigil(augury.kind)} the oracle's {augury.kind} stands today
            </Text>
          ) : null}
        </Text>
      ) : null}
      <Box flexDirection="column" marginTop={1}>
        {roster.length === 0 ? (
          <Text color={COLORS.verdant}>
            The realm map is bare — no dragon dares show its scales. Forge (f) to be sure.
          </Text>
        ) : (
          <>
            {start > 0 ? <Text color={COLORS.parchment}>  … {start} lairs above …</Text> : null}
            {roster.slice(start, end).map((dragon, i) => {
              const index = start + i;
              const chosen = index === clamped;
              return <DragonRow key={dragon.id} dragon={dragon} chosen={chosen} />;
            })}
            {end < roster.length ? (
              <Text color={COLORS.parchment}>  … {roster.length - end} lairs below …</Text>
            ) : null}
          </>
        )}
      </Box>
      <KeyHints
        hints={[
          { key: 'j/k ↑↓', does: 'roam' },
          { key: 'gg/G', does: 'top/bottom' },
          { key: 'enter', does: 'engage' },
          { key: 'v', does: 'sword-school' },
          { key: 'q', does: 'quests' },
          { key: 'o', does: 'oracle' },
          { key: 's', does: 'guild shop' },
          { key: 'f', does: 'forge (coverage)' },
          { key: 'e', does: 'e2e patrol' },
          { key: 'ctrl+c', does: 'quit' },
        ]}
      />
    </Box>
  );
}

function DragonRow({ dragon, chosen }: { dragon: Dragon; chosen: boolean }) {
  if (dragon.slain) {
    return (
      <Text color={COLORS.parchment} dimColor={!chosen}>
        {chosen ? '❯ ' : '  '}☠ {dragon.name} lies slain over {dragon.file}
      </Text>
    );
  }
  const weakenedMark = dragon.weakened > 0 ? ` ⚔${Math.round(dragon.weakened * 100)}%` : '';
  return (
    <Text>
      <Text color={chosen ? COLORS.gold : COLORS.steel}>
        {chosen ? '❯ ' : '  '}
        {speciesSigil(dragon.species)} {dragon.name}
      </Text>
      <Text color={COLORS.parchment}> ({dragon.species}) </Text>
      <Text color={hpColor(dragon.hp, dragon.maxHp)}>{hpBar(dragon.hp, dragon.maxHp, 14)}</Text>
      <Text color={COLORS.steel}>
        {' '}
        {dragon.hp}/{dragon.maxHp} · {formatPct(dragon.coveragePct)} · {dragon.file}
      </Text>
      <Text color={COLORS.torch}>{weakenedMark}</Text>
    </Text>
  );
}
