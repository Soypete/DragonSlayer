/**
 * The Oracle's Cave — two acts.
 *
 * Act 1, the prophecy: where the worst dragons nest (unchanged ritual).
 * Act 2, the DAILY AUGURY: once per real calendar day (or once more, for a
 * bought oracle's token) the cave judges the realm's fortunes, proclaims a
 * blessing / curse / omen, and hands down a style edict. The knight is ASKED
 * before the repo is touched: only a 'y' inscribes the edict's fenced block
 * into CLAUDE.md/AGENTS.md. Same-day revisits find the standing edict and a
 * silent cave. `today` is computed in the UI layer (the Keep) and passed in.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Box, Text } from 'ink';
import { useRealmInput } from '../useRealmInput.js';
import type { Augury, Dragon, GameConfig, OracleProphecy, RepoScan, SaveGame } from '../../types.js';
import { consultOracle } from '../../ai/oracle.js';
import { canConsult, consultAugury, inscribeEdict } from '../../ai/augury.js';
import { COLORS, auguryColor, augurySigil } from '../theme.js';
import { KeyHints } from '../components/KeyHints.js';
import { Spinner } from '../components/Spinner.js';

const WAIT_SUBTITLE = 'consulting the claude CLI — up to 30s; the cave answers regardless';

export interface OracleScreenProps {
  scan: RepoScan;
  dragons: Dragon[];
  save: SaveGame;
  config: GameConfig;
  /** Local calendar day, YYYY-MM-DD — read from the clock in the Keep. */
  today: string;
  /** A bought oracle's token lets one augury past the daily gate. */
  hasOracleToken: boolean;
  /** The cave has spoken: the Keep commits save.augury (and spends the token). */
  onAugury: (augury: Augury) => void;
  onBack: () => void;
}

type CaveAct =
  | { act: 'gate' }
  | { act: 'consulting' }
  | { act: 'consent'; augury: Augury }
  | { act: 'inscribed'; augury: Augury; paths: string[] }
  | { act: 'kept'; augury: Augury };

export function OracleScreen({
  scan,
  dragons,
  save,
  config,
  today,
  hasOracleToken,
  onAugury,
  onBack,
}: OracleScreenProps) {
  const [prophecy, setProphecy] = useState<OracleProphecy | null>(null);
  const [cave, setCave] = useState<CaveAct>({ act: 'gate' });
  const gateOpen = canConsult(save.augury, today) || hasOracleToken;

  const alive = useRef(true);
  useEffect(() => {
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    // consultOracle never throws — it falls back to the heuristic seer.
    void consultOracle(scan, dragons).then((vision) => {
      if (alive.current) setProphecy(vision);
    });
    // One consultation per visit to the cave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const performAugury = () => {
    setCave({ act: 'consulting' });
    const snapshot = {
      coveragePct: scan.coverage?.totals.lines.pct ?? 0,
      testFiles: scan.testFiles.length,
      dragonsSlain: save.stats.dragonsSlain,
    };
    // consultAugury never throws — misfortune collapses into the template pool.
    void consultAugury(save.augury, snapshot, today, scan).then((augury) => {
      onAugury(augury); // the Keep persists save.augury via its commit path.
      if (alive.current) setCave({ act: 'consent', augury });
    });
  };

  useRealmInput((input, key) => {
    if (cave.act === 'consulting') return; // the smoke is still rising.
    if (cave.act === 'consent') {
      // ASK before touching the repo: only an explicit 'y' inscribes.
      if (input === 'y') {
        const paths = inscribeEdict(config.repoPath, cave.augury);
        setCave({ act: 'inscribed', augury: cave.augury, paths });
      } else if (input === 'n') {
        setCave({ act: 'kept', augury: cave.augury });
      }
      return;
    }
    if (key.escape || input === 'o' || key.return) onBack();
    else if (input === 'a' && cave.act === 'gate' && gateOpen) performAugury();
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color={COLORS.arcana}>🔮 The Oracle's Cave</Text>

      {/* ── Act 1: the prophecy ─────────────────────────────────────────── */}
      {!prophecy ? (
        <Box marginTop={1} flexDirection="column">
          <Spinner label="The oracle peers into the uncovered dark…" />
          <Text color={COLORS.parchment}>{WAIT_SUBTITLE}</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <Box borderStyle="round" borderColor={COLORS.arcana} paddingX={1}>
            <Text color={COLORS.arcana} italic>
              “{prophecy.proclamation}”
            </Text>
          </Box>
          <Box flexDirection="column" marginTop={1}>
            {prophecy.hotspots.length === 0 ? (
              <Text color={COLORS.verdant}>The oracle sees no danger. The realm rests easy.</Text>
            ) : (
              prophecy.hotspots.map((spot, i) => (
                <Text key={spot.file}>
                  <Text color={COLORS.ember}>{i + 1}. {spot.file}</Text>
                  <Text color={COLORS.steel}> — {spot.reason}</Text>
                </Text>
              ))
            )}
          </Box>
          <Text color={COLORS.parchment}>
            (spoken by: {prophecy.source === 'claude' ? 'the true oracle' : 'the fallback seer'})
          </Text>
        </Box>
      )}

      {/* ── Act 2: the daily augury ─────────────────────────────────────── */}
      <AuguryAct cave={cave} save={save} today={today} gateOpen={gateOpen} hasOracleToken={hasOracleToken} />

      <CaveHints cave={cave} gateOpen={gateOpen} />
    </Box>
  );
}

function AuguryAct({
  cave,
  save,
  today,
  gateOpen,
  hasOracleToken,
}: {
  cave: CaveAct;
  save: SaveGame;
  today: string;
  gateOpen: boolean;
  hasOracleToken: boolean;
}) {
  if (cave.act === 'consulting') {
    return (
      <Box marginTop={1} flexDirection="column">
        <Spinner label="The cave breathes deep and reads the realm's fortunes…" />
        <Text color={COLORS.parchment}>{WAIT_SUBTITLE}</Text>
      </Box>
    );
  }

  if (cave.act === 'consent' || cave.act === 'inscribed' || cave.act === 'kept') {
    const { augury } = cave;
    return (
      <Box marginTop={1} flexDirection="column">
        <Box borderStyle="double" borderColor={auguryColor(augury.kind)} paddingX={1} flexDirection="column">
          <Text color={auguryColor(augury.kind)}>
            {augurySigil(augury.kind)} THE DAILY AUGURY — {augury.kind.toUpperCase()} ({augury.date})
          </Text>
          <Text color={COLORS.steel} wrap="wrap" italic>
            “{augury.proclamation}”
          </Text>
          <Text wrap="wrap">
            <Text color={COLORS.torch}>Edict: </Text>
            <Text color={COLORS.parchment}>{augury.edict}</Text>
          </Text>
          <HonoredVerdict honored={augury.honored} />
          <Text color={COLORS.parchment}>
            (spoken by: {augury.source === 'claude' ? 'the true oracle' : 'the fallback seer'})
          </Text>
        </Box>
        {cave.act === 'consent' ? (
          <Text color={COLORS.banner}>Inscribe the edict into CLAUDE.md/AGENTS.md? (y/n)</Text>
        ) : cave.act === 'inscribed' ? (
          <Box flexDirection="column">
            <Text color={COLORS.verdant}>The edict is law — inscribed within its fenced block:</Text>
            {cave.paths.map((p) => (
              <Text key={p} color={COLORS.steel}>  {p}</Text>
            ))}
          </Box>
        ) : (
          <Text color={COLORS.parchment}>
            The edict stays within the cave — the repo's scrolls are untouched.
          </Text>
        )}
      </Box>
    );
  }

  // The gate: either today's augury already stands, or the cave will speak.
  const standing = save.augury;
  return (
    <Box marginTop={1} flexDirection="column">
      {standing && standing.date === today ? (
        <Box flexDirection="column">
          <Text color={auguryColor(standing.kind)}>
            {augurySigil(standing.kind)} Today's {standing.kind} stands ({standing.date}).
          </Text>
          <Text wrap="wrap">
            <Text color={COLORS.torch}>Standing edict: </Text>
            <Text color={COLORS.parchment}>{standing.edict}</Text>
          </Text>
          {gateOpen ? (
            <Text color={COLORS.banner}>
              Your oracle's token burns to be spent — press a for one more augury today.
            </Text>
          ) : (
            <Text color={COLORS.parchment}>the cave is silent until tomorrow</Text>
          )}
        </Box>
      ) : (
        <Text color={COLORS.banner}>
          The smoke stirs — press a to perform the daily augury
          {hasOracleToken ? " (the token waits, unneeded — today's consultation is yours by right)" : ''}.
        </Text>
      )}
    </Box>
  );
}

/** The previous augury's reckoning: was its edict honored while it stood? */
function HonoredVerdict({ honored }: { honored: boolean | undefined }) {
  if (honored === undefined) return null;
  return honored ? (
    <Text color={COLORS.verdant}>✓ Yesterday's edict was honored — redemption is recorded.</Text>
  ) : (
    <Text color={COLORS.ember}>✗ Yesterday's edict went unhonored; the cave remembers.</Text>
  );
}

function CaveHints({ cave, gateOpen }: { cave: CaveAct; gateOpen: boolean }) {
  if (cave.act === 'consent') {
    return <KeyHints hints={[{ key: 'y / n', does: 'inscribe the edict, or keep it in-game' }]} />;
  }
  if (cave.act === 'consulting') {
    return <KeyHints hints={[{ key: '…', does: 'the cave is mid-breath' }]} />;
  }
  return (
    <KeyHints
      hints={[
        ...(cave.act === 'gate' && gateOpen ? [{ key: 'a', does: 'the daily augury' }] : []),
        { key: 'esc / o', does: 'leave the cave' },
      ]}
    />
  );
}
