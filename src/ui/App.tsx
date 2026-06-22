/**
 * The Keep — Dragonslayer's screen state machine. Holds the one true
 * SaveGame and RepoScan, persists after every battle and forging, and
 * routes between the halls of the realm.
 *
 * The wall clock is read HERE (the UI layer) and nowhere purer: `localDay`
 * turns it into the YYYY-MM-DD string the augury gate and the blessing
 * multiplier ride on.
 */

import React, { useState } from 'react';
import type { Augury, BattleResult, Dragon, GameConfig, Quest, RepoScan, SaveGame } from '../types.js';
import { applyBattle, hasWon, newSave, writeSave } from '../game/state.js';
import { isPledged, togglePledge } from '../game/shop.js';
import { buildDragons } from '../repo/scanner.js';
import { dragonName } from '../game/naming.js';
import { renounceSkill } from '../ai/squire.js';
import { canConsult } from '../ai/augury.js';
import { blessSpoils, chronicleScan, dullBlade, localDay } from './logic.js';
import { TitleScreen } from './screens/TitleScreen.js';
import { MapScreen } from './screens/MapScreen.js';
import { BattleScreen } from './screens/BattleScreen.js';
import { QuestsScreen } from './screens/QuestsScreen.js';
import { OracleScreen } from './screens/OracleScreen.js';
import { ShopScreen } from './screens/ShopScreen.js';
import { ForgeScreen, type ForgeMode } from './screens/ForgeScreen.js';
import { VictoryScreen } from './screens/VictoryScreen.js';
import { TrialsScreen } from './screens/TrialsScreen.js';

export type Screen =
  | 'title'
  | 'map'
  | 'battle'
  | 'quests'
  | 'oracle'
  | 'shop'
  | 'forge'
  | 'victory'
  | 'trials';

export interface AppProps {
  config: GameConfig;
  initialScan: RepoScan;
  initialSave: SaveGame;
  /** True if an old chronicle (save file) existed before this boot. */
  hadChronicle: boolean;
  /** Offered by the Crossroads: return to the Hall of Banners. */
  onSwitchRealm?: () => void;
}

export function App({ config, initialScan, initialSave, hadChronicle, onSwitchRealm }: AppProps) {
  const [screen, setScreen] = useState<Screen>('title');
  const [save, setSave] = useState<SaveGame>(initialSave);
  const [scan, setScan] = useState<RepoScan>(initialScan);
  const [foe, setFoe] = useState<Dragon | null>(null);
  const [forgeMode, setForgeMode] = useState<ForgeMode>('coverage');
  /** The oracle's token rides in a pocket, not the chronicle: it dies with the session. */
  const [oracleToken, setOracleToken] = useState(false);

  // The one sanctioned clock-read: today's local calendar day.
  const today = localDay(new Date());

  /** Persist and adopt a new chronicle in one stroke. */
  const commit = (next: SaveGame) => {
    writeSave(next);
    setSave(next);
  };

  const rideForth = () => {
    setScreen(hasWon(save, scan) ? 'victory' : 'map');
  };

  const swearNewOath = () => {
    const dragons = buildDragons(scan, dragonName);
    commit(chronicleScan(newSave(config.repoPath), scan, dragons, today));
    setScreen('map');
  };

  const engage = (dragon: Dragon) => {
    setFoe(dragon);
    setScreen('battle');
  };

  const collectSpoils = (dragonId: string, result: BattleResult) => {
    // The spoils path: a same-day BLESSING multiplies battle XP ×1.1 here
    // (blessSpoils), then the battle is banked and any sharpened-blade buff
    // the fight consumed is dulled back to 1.
    commit(dullBlade(applyBattle(save, dragonId, blessSpoils(result, save.augury, today), today)));
  };

  const openForge = (mode: ForgeMode) => {
    setForgeMode(mode);
    setScreen('forge');
  };

  const adoptChronicle = (freshScan: RepoScan, freshSave: SaveGame) => {
    // ForgeScreen has already persisted the save; just adopt it.
    setScan(freshScan);
    setSave(freshSave);
  };

  /**
   * Pledging is free and toggles; renouncing also asks the squire to remove
   * the forged skill — errors tolerated (the pledge falls either way).
   */
  const swearOrRenounce = (quest: Quest) => {
    if (isPledged(save, quest.id)) {
      try {
        renounceSkill(quest, config);
      } catch {
        // The scroll resisted removal; the renunciation stands regardless.
      }
    }
    commit(togglePledge(save, quest.id));
  };

  /** The cave has spoken: chronicle the augury; a token-gated consult spends the token. */
  const recordAugury = (augury: Augury) => {
    if (!canConsult(save.augury, today)) setOracleToken(false);
    commit({ ...save, augury });
  };

  switch (screen) {
    case 'title':
      return (
        <TitleScreen
          save={save}
          repoPath={config.repoPath}
          hasChronicle={hadChronicle}
          onContinue={rideForth}
          onNewQuest={swearNewOath}
          onSwitchRealm={onSwitchRealm}
        />
      );
    case 'map':
      return (
        <MapScreen
          save={save}
          scan={scan}
          today={today}
          onEngage={engage}
          onQuests={() => setScreen('quests')}
          onOracle={() => setScreen('oracle')}
          onForge={() => openForge('coverage')}
          onE2e={() => openForge('e2e')}
          onTrials={() => setScreen('trials')}
          onShop={() => setScreen('shop')}
        />
      );
    case 'battle':
      return foe ? (
        <BattleScreen
          dragon={foe}
          repoPath={config.repoPath}
          blade={save.vim?.bladeBuff ?? 1}
          onSpoils={collectSpoils}
          onLeave={() => {
            setFoe(null);
            setScreen('map');
          }}
        />
      ) : null;
    case 'quests':
      return (
        <QuestsScreen
          save={save}
          scan={scan}
          config={config}
          onPledge={swearOrRenounce}
          onChronicle={commit}
          onBack={() => setScreen('map')}
        />
      );
    case 'oracle':
      return (
        <OracleScreen
          scan={scan}
          dragons={save.dragons.filter((d) => !d.slain)}
          save={save}
          config={config}
          today={today}
          hasOracleToken={oracleToken}
          onAugury={recordAugury}
          onBack={() => setScreen('map')}
        />
      );
    case 'shop':
      return (
        <ShopScreen
          save={save}
          scan={scan}
          config={config}
          hasOracleToken={oracleToken}
          onOracleToken={() => setOracleToken(true)}
          onChronicle={commit}
          onBack={() => setScreen('map')}
        />
      );
    case 'forge':
      return (
        <ForgeScreen
          config={config}
          mode={forgeMode}
          save={save}
          today={today}
          onChronicled={adoptChronicle}
          onDone={(won) => setScreen(won ? 'victory' : 'map')}
        />
      );
    case 'trials':
      return <TrialsScreen save={save} onChronicle={commit} onBack={() => setScreen('map')} />;
    case 'victory':
      return <VictoryScreen save={save} onBackToMap={() => setScreen('map')} />;
  }
}
