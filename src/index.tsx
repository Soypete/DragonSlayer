#!/usr/bin/env node
/**
 * Dragonslayer (gme) — muster the campaign and raise the banner.
 *
 *   gme [--repo <path>]
 *
 * Defaults to ./practice-dungeon when it stands in cwd, else cwd itself.
 */

import React from 'react';
import { render } from 'ink';
import { existsSync } from 'node:fs';
import { resolveRepoPath } from './ui/cli.js';
import { resolveConfig } from './repo/config.js';
import { scanRepo, buildDragons } from './repo/scanner.js';
import { dragonName } from './game/naming.js';
import { loadSave, newSave, writeSave } from './game/state.js';
import { chronicleScan } from './ui/logic.js';
import { App } from './ui/App.js';

async function main(): Promise<void> {
  const repoPath = resolveRepoPath(process.argv.slice(2), process.cwd(), existsSync);
  const config = await resolveConfig(repoPath);
  const scan = await scanRepo(config);
  const dragons = buildDragons(scan, dragonName);

  const chronicle = loadSave(repoPath);
  const save = chronicleScan(chronicle ?? newSave(repoPath), scan, dragons);
  writeSave(save);

  render(
    <App
      config={config}
      initialScan={scan}
      initialSave={save}
      hadChronicle={chronicle !== null}
    />,
    { exitOnCtrlC: true },
  );
}

main().catch((err: unknown) => {
  console.error('The campaign failed to muster:', err);
  process.exitCode = 1;
});
