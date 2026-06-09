/**
 * The Keep — Dragonslayer's screen state machine. Holds the one true
 * SaveGame and RepoScan, persists after every battle and forging, and
 * routes between the halls of the realm.
 */

import React, { useState } from 'react';
import type { BattleResult, Dragon, GameConfig, RepoScan, SaveGame } from '../types.js';
import { applyBattle, hasWon, newSave, writeSave } from '../game/state.js';
import { buildDragons } from '../repo/scanner.js';
import { dragonName } from '../game/naming.js';
import { chronicleScan } from './logic.js';
import { TitleScreen } from './screens/TitleScreen.js';
import { MapScreen } from './screens/MapScreen.js';
import { BattleScreen } from './screens/BattleScreen.js';
import { QuestsScreen } from './screens/QuestsScreen.js';
import { OracleScreen } from './screens/OracleScreen.js';
import { ForgeScreen, type ForgeMode } from './screens/ForgeScreen.js';
import { VictoryScreen } from './screens/VictoryScreen.js';

export type Screen = 'title' | 'map' | 'battle' | 'quests' | 'oracle' | 'forge' | 'victory';

export interface AppProps {
  config: GameConfig;
  initialScan: RepoScan;
  initialSave: SaveGame;
  /** True if an old chronicle (save file) existed before this boot. */
  hadChronicle: boolean;
}

export function App({ config, initialScan, initialSave, hadChronicle }: AppProps) {
  const [screen, setScreen] = useState<Screen>('title');
  const [save, setSave] = useState<SaveGame>(initialSave);
  const [scan, setScan] = useState<RepoScan>(initialScan);
  const [foe, setFoe] = useState<Dragon | null>(null);
  const [forgeMode, setForgeMode] = useState<ForgeMode>('coverage');

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
    commit(chronicleScan(newSave(config.repoPath), scan, dragons));
    setScreen('map');
  };

  const engage = (dragon: Dragon) => {
    setFoe(dragon);
    setScreen('battle');
  };

  const collectSpoils = (dragonId: string, result: BattleResult) => {
    commit(applyBattle(save, dragonId, result));
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

  switch (screen) {
    case 'title':
      return (
        <TitleScreen
          save={save}
          hasChronicle={hadChronicle}
          onContinue={rideForth}
          onNewQuest={swearNewOath}
        />
      );
    case 'map':
      return (
        <MapScreen
          save={save}
          scan={scan}
          onEngage={engage}
          onQuests={() => setScreen('quests')}
          onOracle={() => setScreen('oracle')}
          onForge={() => openForge('coverage')}
          onE2e={() => openForge('e2e')}
        />
      );
    case 'battle':
      return foe ? (
        <BattleScreen
          dragon={foe}
          repoPath={config.repoPath}
          onSpoils={collectSpoils}
          onLeave={() => {
            setFoe(null);
            setScreen('map');
          }}
        />
      ) : null;
    case 'quests':
      return <QuestsScreen quests={save.quests} onBack={() => setScreen('map')} />;
    case 'oracle':
      return (
        <OracleScreen
          scan={scan}
          dragons={save.dragons.filter((d) => !d.slain)}
          onBack={() => setScreen('map')}
        />
      );
    case 'forge':
      return (
        <ForgeScreen
          config={config}
          mode={forgeMode}
          save={save}
          onChronicled={adoptChronicle}
          onDone={(won) => setScreen(won ? 'victory' : 'map')}
        />
      );
    case 'victory':
      return <VictoryScreen save={save} onBackToMap={() => setScreen('map')} />;
  }
}
