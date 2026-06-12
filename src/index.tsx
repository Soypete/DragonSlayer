#!/usr/bin/env node
/**
 * Dragonslayer (gme) — muster the campaign and raise the banner.
 *
 *   gme [--repo <path>]
 *
 * With --repo the knight rides straight into that realm. Without it the
 * Hall of Banners opens: every known campaign (saves + the hand-editable
 * ~/.gme/config.json registry), the herald's suggestion (./practice-dungeon
 * when it stands in cwd, else cwd), and a path prompt for new realms.
 */

import React from 'react';
import { render } from 'ink';
import { existsSync } from 'node:fs';
import { parseRepoFlag, suggestRealm } from './ui/cli.js';
import { musterCampaign } from './ui/muster.js';
import { Root } from './ui/Root.js';

async function main(): Promise<void> {
  const cwd = process.cwd();
  const summoned = parseRepoFlag(process.argv.slice(2), cwd);
  const initialCampaign = summoned ? await musterCampaign(summoned) : null;

  render(
    <Root
      initialCampaign={initialCampaign}
      suggestedRepo={suggestRealm(cwd, existsSync)}
    />,
    { exitOnCtrlC: true },
  );
}

main().catch((err: unknown) => {
  console.error('The campaign failed to muster:', err);
  process.exitCode = 1;
});
