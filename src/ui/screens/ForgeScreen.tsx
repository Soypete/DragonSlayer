/**
 * The Forge — where dragons actually die. Runs the realm's coverage (or e2e)
 * command with streamed output, rescans the repo, rebuilds the roster,
 * chronicles the scan, persists the save, and checks for total victory.
 */

import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { useRealmInput } from '../useRealmInput.js';
import type { CommandRun, GameConfig, RepoScan, SaveGame } from '../../types.js';
import { scanRepo, buildDragons } from '../../repo/scanner.js';
import { runCommand } from '../../repo/runner.js';
import { dragonName } from '../../game/naming.js';
import { writeSave, hasWon } from '../../game/state.js';
import { chronicleScan } from '../logic.js';
import { COLORS, formatDuration, formatPct } from '../theme.js';
import { KeyHints } from '../components/KeyHints.js';
import { Spinner } from '../components/Spinner.js';

export type ForgeMode = 'coverage' | 'e2e';

export interface ForgeScreenProps {
  config: GameConfig;
  mode: ForgeMode;
  save: SaveGame;
  /** Today's local calendar day (YYYY-MM-DD), threaded from the Keep. */
  today: string;
  /** Fired once the new scan + save are chronicled and persisted. */
  onChronicled: (scan: RepoScan, save: SaveGame) => void;
  /** Leave the forge; `won` routes to the victory hall. */
  onDone: (won: boolean) => void;
}

type Phase = 'kindling' | 'scrying' | 'done' | 'unarmed';

interface ForgeReport {
  run: CommandRun;
  before: SaveGame;
  after: SaveGame;
  scan: RepoScan;
  won: boolean;
}

const EMBER_LINES = 14;

export function ForgeScreen({ config, mode, save, today, onChronicled, onDone }: ForgeScreenProps) {
  const command = mode === 'e2e' ? config.e2eCommand : config.coverageCommand;
  const [phase, setPhase] = useState<Phase>(command ? 'kindling' : 'unarmed');
  const [embers, setEmbers] = useState('');
  const [report, setReport] = useState<ForgeReport | null>(null);

  useEffect(() => {
    if (!command) return;
    let alive = true;
    (async () => {
      const run = await runCommand(command, config.repoPath, (chunk) => {
        if (alive) {
          setEmbers((prev) => {
            const lines = (prev + chunk).split('\n');
            return lines.slice(-EMBER_LINES).join('\n');
          });
        }
      });
      if (!alive) return;
      setPhase('scrying');

      const scan = await scanRepo(config);
      if (!alive) return;
      const dragons = buildDragons(scan, dragonName);
      const after = chronicleScan(save, scan, dragons, today);
      writeSave(after);
      const won = hasWon(after, scan);
      setReport({ run, before: save, after, scan, won });
      onChronicled(scan, after);
      setPhase('done');
    })();
    return () => {
      alive = false;
    };
    // The forge is lit exactly once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealmInput((input, key) => {
    if (phase === 'unarmed' && (key.escape || key.return)) onDone(false);
    if (phase === 'done' && report && (key.escape || key.return)) onDone(report.won);
  });

  if (phase === 'unarmed') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color={COLORS.torch}>
          ⚒ The forge stands cold: no {mode === 'e2e' ? 'e2e' : 'coverage'} command is configured.
        </Text>
        <Text color={COLORS.parchment}>
          Inscribe one in gme.config.json ({mode === 'e2e' ? '"e2eCommand"' : '"coverageCommand"'}).
        </Text>
        <KeyHints hints={[{ key: 'esc', does: 'back to the realm map' }]} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color={COLORS.torch}>
        ⚒ The Forge {mode === 'e2e' ? '— e2e patrol' : '— coverage crucible'}
      </Text>
      <Text color={COLORS.parchment}>$ {command}</Text>

      {phase !== 'done' ? (
        <Box flexDirection="column" marginTop={1}>
          <Spinner
            label={phase === 'kindling' ? 'The bellows roar — tests are running…' : 'Scrying the fresh coverage scrolls…'}
          />
          {embers ? (
            <Box borderStyle="single" borderColor={COLORS.steel} paddingX={1} marginTop={1}>
              <Text color={COLORS.parchment}>{embers}</Text>
            </Box>
          ) : null}
        </Box>
      ) : report ? (
        <ForgeSummary report={report} />
      ) : null}

      {phase === 'done' ? (
        <KeyHints hints={[{ key: 'enter / esc', does: report?.won ? 'claim victory' : 'back to the realm map' }]} />
      ) : null}
    </Box>
  );
}

function ForgeSummary({ report }: { report: ForgeReport }) {
  const { run, before, after, scan, won } = report;
  const prevPct = before.lastScan?.coveragePct ?? 0;
  const newPct = scan.coverage?.totals.lines.pct ?? 0;
  const slain = after.stats.dragonsSlain - before.stats.dragonsSlain;
  const xpGained = after.xp - before.xp;
  const goldGained = after.gold - before.gold;
  const passed = run.exitCode === 0;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box borderStyle="double" borderColor={passed ? COLORS.verdant : COLORS.ember} paddingX={1} flexDirection="column">
        <Text color={passed ? COLORS.verdant : COLORS.ember}>
          {passed ? '✓ The suite held the line' : `✗ The suite buckled (exit ${run.exitCode})`}
          <Text color={COLORS.parchment}> · {formatDuration(run.durationMs)}</Text>
        </Text>
        <Text color={COLORS.steel}>
          Coverage {formatPct(prevPct)} → <Text color={newPct > prevPct ? COLORS.verdant : COLORS.torch}>{formatPct(newPct)}</Text>
          {'   '}Dragons slain this forging: <Text color={slain > 0 ? COLORS.gold : COLORS.steel}>{slain}</Text>
        </Text>
        <Text color={COLORS.steel}>
          Spoils: <Text color={COLORS.gold}>+{xpGained} XP</Text>, <Text color={COLORS.gold}>+{goldGained} gold</Text>
        </Text>
        {won ? (
          <Text color={COLORS.gold}>👑 Every line is covered and the e2e patrol walks — the realm is won!</Text>
        ) : null}
      </Box>
      {!passed && run.output ? (
        <Box borderStyle="single" borderColor={COLORS.ember} paddingX={1} marginTop={1}>
          <Text color={COLORS.parchment}>{run.output.split('\n').slice(-EMBER_LINES).join('\n')}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
