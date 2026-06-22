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
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRepoPath, parseRepoFlag, suggestRealm } from './ui/cli.js';
import { runLeaderboard } from './ui/cli-leaderboard.js';
import { musterCampaign } from './ui/muster.js';
import { Root } from './ui/Root.js';

/** The realm's own version, read from the bundled package.json. */
function gameVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(join(here, '..', 'package.json'), 'utf8');
    const pkg = JSON.parse(raw) as { version?: unknown };
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const argv = process.argv.slice(2);

  // The leaderboard road runs outside the Ink banner: read, seal, ride back.
  if (argv[0] === 'leaderboard') {
    const code = runLeaderboard({
      rest: argv.slice(1),
      defaultRepo: resolveRepoPath(argv, cwd, existsSync),
      gameVersion: gameVersion(),
      now: () => new Date(),
      print: (line) => console.log(line),
      printErr: (line) => console.error(line),
    });
    process.exitCode = code;
    return;
  }

  const summoned = parseRepoFlag(argv, cwd);
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
