/**
 * The Guild Shop — where gold finally leaves the purse. Three wares:
 * a Claude-skill forging for a pledged quest (25g, pick the quest here),
 * the oracle's token (50g, one extra augury today), and the sharpening
 * stone (30g, a ×1.2 edge for the next battle). Unaffordable wares hang
 * gray behind the counter: the guild extends no credit.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Box, Text } from 'ink';
import { useRealmInput } from '../useRealmInput.js';
import type { GameConfig, Quest, RepoScan, SaveGame, ShopItemId, SkillForgeResult } from '../../types.js';
import { forgeSkill } from '../../ai/squire.js';
import {
  FORGE_SKILL_COST,
  NO_CREDIT,
  SHOP_WARES,
  STONE_BLADE,
  applySharpeningStone,
  canAfford,
  pledgedIncompleteQuests,
  refundGold,
  spendGold,
  type ShopWare,
} from '../../game/shop.js';
import { COLORS, PLEDGE_SIGIL } from '../theme.js';
import { KeyHints } from '../components/KeyHints.js';
import { Spinner } from '../components/Spinner.js';

export interface ShopScreenProps {
  save: SaveGame;
  scan: RepoScan;
  config: GameConfig;
  /** Is the oracle's token already in the knight's pocket? */
  hasOracleToken: boolean;
  /** A token was bought — the Keep holds it (transient, not chronicled). */
  onOracleToken: () => void;
  /** Persist-and-adopt a purchase's gold/buff mutation. */
  onChronicle: (next: SaveGame) => void;
  onBack: () => void;
}

type Counter =
  | { phase: 'browse'; note?: string }
  | { phase: 'pick-quest'; cursor: number }
  | { phase: 'forging'; quest: Quest }
  | { phase: 'forged'; quest: Quest; result: SkillForgeResult }
  | { phase: 'refused'; note: string };

/** Why a ware hangs gray, or null when it can be bought. */
function bar(ware: ShopWare, save: SaveGame, hasOracleToken: boolean): string | null {
  if (!canAfford(save, ware.cost)) return NO_CREDIT;
  if (ware.id === 'forge-skill' && pledgedIncompleteQuests(save).length === 0) {
    return 'pledge a quest on the guild board first';
  }
  if (ware.id === 'oracle-token' && hasOracleToken) {
    return "you already carry the oracle's token";
  }
  if (ware.id === 'sharpening-stone' && (save.vim?.bladeBuff ?? 1) >= STONE_BLADE) {
    return `your edge is already keen (×${(save.vim?.bladeBuff ?? 1).toFixed(1)})`;
  }
  return null;
}

export function ShopScreen({ save, scan, config, hasOracleToken, onOracleToken, onChronicle, onBack }: ShopScreenProps) {
  const [cursor, setCursor] = useState(0);
  const [counter, setCounter] = useState<Counter>({ phase: 'browse' });
  const pledged = pledgedIncompleteQuests(save);

  const alive = useRef(true);
  useEffect(() => {
    return () => {
      alive.current = false;
    };
  }, []);

  /** Debit 25 gold and put the squire to work; refund if the forge throws. */
  const buyForging = (quest: Quest) => {
    const debited = spendGold(save, FORGE_SKILL_COST);
    onChronicle(debited);
    setCounter({ phase: 'forging', quest });
    void forgeSkill(quest, scan, config, save.dragons).then(
      (result) => {
        if (alive.current) setCounter({ phase: 'forged', quest, result });
      },
      (err: unknown) => {
        // A foreign SKILL.md blocked the path — the guild refunds in full.
        onChronicle(refundGold(debited, FORGE_SKILL_COST));
        if (alive.current) {
          setCounter({ phase: 'refused', note: `${err instanceof Error ? err.message : String(err)} (your ${FORGE_SKILL_COST} gold is refunded.)` });
        }
      },
    );
  };

  const buy = (id: ShopItemId) => {
    switch (id) {
      case 'forge-skill':
        if (pledged.length === 1) buyForging(pledged[0]);
        else setCounter({ phase: 'pick-quest', cursor: 0 });
        return;
      case 'oracle-token':
        onChronicle(spendGold(save, SHOP_WARES[1].cost));
        onOracleToken();
        setCounter({ phase: 'browse', note: "The oracle's token glints in your palm — the cave will speak once more today." });
        return;
      case 'sharpening-stone':
        onChronicle(applySharpeningStone(save));
        setCounter({ phase: 'browse', note: `The stone sings along your blade — ×${STONE_BLADE.toFixed(1)} for the next battle.` });
        return;
      default:
        return;
    }
  };

  useRealmInput((input, key) => {
    if (counter.phase === 'forging') return;
    if (counter.phase === 'forged' || counter.phase === 'refused') {
      if (key.return || key.escape || input === 'q') setCounter({ phase: 'browse' });
      return;
    }
    if (counter.phase === 'pick-quest') {
      const count = Math.max(1, pledged.length);
      if (key.escape || input === 'q') setCounter({ phase: 'browse' });
      else if (key.upArrow || input === 'k') setCounter({ phase: 'pick-quest', cursor: (counter.cursor + count - 1) % count });
      else if (key.downArrow || input === 'j') setCounter({ phase: 'pick-quest', cursor: (counter.cursor + 1) % count });
      else if (key.return) {
        const quest = pledged[Math.min(counter.cursor, pledged.length - 1)];
        if (quest) buyForging(quest);
      }
      return;
    }
    // browse
    if (key.escape || input === 'q' || input === 's') onBack();
    else if (key.upArrow || input === 'k') {
      setCounter({ phase: 'browse' });
      setCursor((c) => (c + SHOP_WARES.length - 1) % SHOP_WARES.length);
    } else if (key.downArrow || input === 'j') {
      setCounter({ phase: 'browse' });
      setCursor((c) => (c + 1) % SHOP_WARES.length);
    } else if (key.return) {
      const ware = SHOP_WARES[cursor];
      const barred = bar(ware, save, hasOracleToken);
      if (barred !== null) setCounter({ phase: 'browse', note: barred === NO_CREDIT ? `${NO_CREDIT} — ${ware.cost} gold for ${ware.name.toLowerCase()}, and your purse holds ${save.gold}.` : barred });
      else buy(ware.id);
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text>
        <Text color={COLORS.gold}>🏪 The Guild Shop</Text>
        <Text color={COLORS.steel}>  ·  </Text>
        <Text color={COLORS.gold}>⛁ {save.gold} gold</Text>
      </Text>
      <Text color={COLORS.parchment}>XP is the ladder; gold buys the rungs. Hint rungs are sold mid-trial at the sword-school.</Text>

      {counter.phase === 'pick-quest' ? (
        <QuestPicker pledged={pledged} cursor={counter.cursor} />
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {SHOP_WARES.map((ware, i) => (
            <WareRow
              key={ware.id}
              ware={ware}
              chosen={i === cursor && counter.phase === 'browse'}
              barred={bar(ware, save, hasOracleToken)}
            />
          ))}
        </Box>
      )}

      <CounterReport counter={counter} />

      {counter.phase === 'forged' || counter.phase === 'refused' ? (
        <KeyHints hints={[{ key: 'enter / esc', does: 'back to the shelf' }]} />
      ) : counter.phase === 'pick-quest' ? (
        <KeyHints
          hints={[
            { key: 'j/k ↑↓', does: 'choose the sworn deed' },
            { key: 'enter', does: `forge it — ${FORGE_SKILL_COST} gold` },
            { key: 'esc', does: 'back to the shelf' },
          ]}
        />
      ) : (
        <KeyHints
          hints={[
            { key: 'j/k ↑↓', does: 'browse' },
            { key: 'enter', does: 'buy' },
            { key: 'esc / s / q', does: 'back to the realm map' },
          ]}
        />
      )}
    </Box>
  );
}

function WareRow({ ware, chosen, barred }: { ware: ShopWare; chosen: boolean; barred: string | null }) {
  if (barred !== null) {
    return (
      <Box flexDirection="column">
        <Text dimColor>
          {chosen ? '❯ ' : '  '}{ware.name} — {ware.cost} gold · {ware.blurb}
        </Text>
        <Text color={COLORS.parchment} dimColor>
          {'      '}({barred})
        </Text>
      </Box>
    );
  }
  return (
    <Box flexDirection="column">
      <Text>
        <Text color={chosen ? COLORS.gold : COLORS.steel}>{chosen ? '❯ ' : '  '}{ware.name}</Text>
        <Text color={COLORS.gold}> — {ware.cost} gold</Text>
        <Text color={COLORS.parchment}> · {ware.blurb}</Text>
      </Text>
    </Box>
  );
}

/** Which sworn deed shall the squire forge for? */
function QuestPicker({ pledged, cursor }: { pledged: Quest[]; cursor: number }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={COLORS.banner}>Which sworn deed shall the squire forge a skill for?</Text>
      {pledged.map((quest, i) => (
        <Text key={quest.id}>
          <Text color={i === cursor ? COLORS.gold : COLORS.steel}>
            {i === cursor ? '❯ ' : '  '}{PLEDGE_SIGIL} {quest.title}
          </Text>
          <Text color={COLORS.parchment}> [{quest.kind}]</Text>
        </Text>
      ))}
    </Box>
  );
}

function CounterReport({ counter }: { counter: Counter }) {
  if (counter.phase === 'pick-quest') return null;
  if (counter.phase === 'browse') {
    return counter.note ? (
      <Box marginTop={1}>
        <Text color={COLORS.torch} wrap="wrap">{counter.note}</Text>
      </Box>
    ) : null;
  }
  if (counter.phase === 'forging') {
    return (
      <Box marginTop={1} flexDirection="column">
        <Spinner label={`The squire heats the anvil for “${counter.quest.title}”…`} />
        <Text color={COLORS.parchment}>claude tailors the skill — up to 30s; the template stands in if the seer is silent.</Text>
      </Box>
    );
  }
  if (counter.phase === 'forged') {
    return (
      <Box marginTop={1} borderStyle="round" borderColor={COLORS.verdant} paddingX={1} flexDirection="column">
        <Text color={COLORS.verdant}>⚒ The skill is forged! Your coding sessions now know the quest.</Text>
        <Text color={COLORS.steel}>{counter.result.path}</Text>
        <Text color={COLORS.parchment}>
          (tailored by: {counter.result.source === 'claude' ? 'the true seer' : 'the deterministic template'})
        </Text>
      </Box>
    );
  }
  return (
    <Box marginTop={1} borderStyle="round" borderColor={COLORS.torch} paddingX={1} flexDirection="column">
      <Text color={COLORS.torch}>The squire stays his hammer.</Text>
      <Text color={COLORS.steel} wrap="wrap">{counter.note}</Text>
    </Box>
  );
}
