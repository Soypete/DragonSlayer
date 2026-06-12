/**
 * The Crossroads — above the Keep sits the choice of realm. With a --repo
 * summons the knight rides straight in; otherwise the Hall of Banners
 * (campaign picker) opens. Each campaign mounts the Keep fresh (keyed by
 * realm path), so the Keep itself never learns about other realms.
 */

import React, { useState } from 'react';
import { Box } from 'ink';
import { existsSync } from 'node:fs';
import { listSaves } from '../game/state.js';
import { loadRegistry } from '../game/registry.js';
import { musterCampaignEntries } from './logic.js';
import { musterCampaign, type Campaign } from './muster.js';
import { App } from './App.js';
import { CampaignScreen } from './screens/CampaignScreen.js';
import { Spinner } from './components/Spinner.js';

type Phase =
  | { kind: 'pick'; error: string | null }
  | { kind: 'mustering'; repoPath: string }
  | { kind: 'play'; campaign: Campaign };

export interface RootProps {
  /** Pre-mustered campaign from a --repo summons; null opens the picker. */
  initialCampaign: Campaign | null;
  /** The herald's suggestion for "Quest here". */
  suggestedRepo: string;
}

export function Root({ initialCampaign, suggestedRepo }: RootProps) {
  const [phase, setPhase] = useState<Phase>(
    initialCampaign
      ? { kind: 'play', campaign: initialCampaign }
      : { kind: 'pick', error: null },
  );

  const rideInto = (repoPath: string) => {
    setPhase({ kind: 'mustering', repoPath });
    void musterCampaign(repoPath).then(
      (campaign) => setPhase({ kind: 'play', campaign }),
      (err: unknown) =>
        setPhase({
          kind: 'pick',
          error: `The muster at ${repoPath} failed: ${err instanceof Error ? err.message : String(err)}`,
        }),
    );
  };

  switch (phase.kind) {
    case 'pick':
      return (
        <CampaignScreen
          entries={musterCampaignEntries(listSaves(), loadRegistry().repos, existsSync)}
          suggestedRepo={suggestedRepo}
          error={phase.error}
          onChoose={rideInto}
          onChart={rideInto}
          exists={existsSync}
          cwd={process.cwd()}
        />
      );
    case 'mustering':
      return (
        <Box paddingX={1}>
          <Spinner label={`Riding to ${phase.repoPath}…`} />
        </Box>
      );
    case 'play':
      return (
        <App
          key={phase.campaign.config.repoPath}
          config={phase.campaign.config}
          initialScan={phase.campaign.scan}
          initialSave={phase.campaign.save}
          hadChronicle={phase.campaign.hadChronicle}
          onSwitchRealm={() => setPhase({ kind: 'pick', error: null })}
        />
      );
  }
}
