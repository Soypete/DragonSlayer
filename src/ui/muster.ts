/**
 * Mustering — the one road from a repo path to a playable campaign:
 * resolve the ledger, survey the realm, take the dragon census, unseal
 * (or begin) the chronicle, fold the scan in, persist, and chart the
 * realm into the global registry. UI layer: it may import every guild.
 */

import { existsSync } from 'node:fs';
import type { GameConfig, RepoScan, SaveGame } from '../types.js';
import { resolveConfig } from '../repo/config.js';
import { buildDragons, scanRepo } from '../repo/scanner.js';
import { dragonName } from '../game/naming.js';
import { loadSave, newSave, writeSave } from '../game/state.js';
import { registerRepo } from '../game/registry.js';
import { chronicleScan, localDay } from './logic.js';

export interface Campaign {
  config: GameConfig;
  scan: RepoScan;
  save: SaveGame;
  /** True if an old chronicle (save file) existed before this muster. */
  hadChronicle: boolean;
}

/** Ride into a realm and raise the banner. Throws if the survey fails. */
export async function musterCampaign(repoPath: string): Promise<Campaign> {
  const config = await resolveConfig(repoPath);
  const scan = await scanRepo(config);
  const dragons = buildDragons(scan, dragonName);

  const chronicle = loadSave(config.repoPath);
  // UI layer: the muster reads the wall clock to date this boot's scan-fold.
  const save = chronicleScan(chronicle ?? newSave(config.repoPath), scan, dragons, localDay(new Date()));
  writeSave(save);

  // Chart only realms that truly stand — a typo'd --repo stays off the ledger.
  if (existsSync(config.repoPath)) registerRepo(config.repoPath);

  return { config, scan, save, hadChronicle: chronicle !== null };
}
