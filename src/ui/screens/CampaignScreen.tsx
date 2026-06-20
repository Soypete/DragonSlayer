/**
 * The Hall of Banners — pick which realm to ride into. Lists every known
 * campaign (chronicles in the vault plus hand-charted registry entries),
 * offers the herald's suggestion, and lets a knight chart a new realm by
 * path. Realms that no longer stand are shown dimmed and cannot be opened.
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import * as path from 'node:path';
import { useRealmInput } from '../useRealmInput.js';
import type { CampaignEntry } from '../../types.js';
import { rankForXp } from '../../game/ranks.js';
import { BANNER, COLORS } from '../theme.js';
import { scrollWindow } from '../logic.js';
import { KeyHints } from '../components/KeyHints.js';

const LIST_HEIGHT = 8;

export interface CampaignScreenProps {
  entries: CampaignEntry[];
  /** The herald's unbidden suggestion (practice-dungeon in cwd, else cwd). */
  suggestedRepo: string;
  /** A grievance from a failed muster, shown until the next choice. */
  error?: string | null;
  onChoose: (repoPath: string) => void;
  /** Chart a new realm from a hand-typed path (already resolved). */
  onChart: (repoPath: string) => void;
  /** Does the typed path stand on disk? Injected for testability. */
  exists: (path: string) => boolean;
  cwd: string;
}

type Row =
  | { kind: 'suggested'; repoPath: string }
  | { kind: 'entry'; entry: CampaignEntry }
  | { kind: 'chart' };

function entryLine(entry: CampaignEntry): string {
  if (!entry.save) return 'unplayed — a blank page awaits';
  const rank = rankForXp(entry.save.xp);
  const coverage =
    entry.save.lastScan !== undefined
      ? `, ${entry.save.lastScan.coveragePct.toFixed(1)}% covered`
      : '';
  return (
    `${rank.sigil} ${rank.title} — ${entry.save.xp} XP, ${entry.save.gold} gold, ` +
    `${entry.save.stats.dragonsSlain} slain${coverage}`
  );
}

export function CampaignScreen({
  entries,
  suggestedRepo,
  error,
  onChoose,
  onChart,
  exists,
  cwd,
}: CampaignScreenProps) {
  const listed = new Set(entries.map((e) => e.repoPath));
  const rows: Row[] = [
    ...(listed.has(suggestedRepo)
      ? []
      : [{ kind: 'suggested', repoPath: suggestedRepo } as Row]),
    ...entries.map((entry): Row => ({ kind: 'entry', entry })),
    { kind: 'chart' },
  ];

  const [cursor, setCursor] = useState(0);
  const [charting, setCharting] = useState(false);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(error ?? null);

  useRealmInput((input, key) => {
    if (charting) {
      if (key.escape) {
        setCharting(false);
        setDraft('');
      } else if (key.return) {
        const typed = draft.trim();
        if (typed === '') return;
        const realm = path.resolve(cwd, typed);
        if (exists(realm)) {
          onChart(realm);
        } else {
          setNotice(`No realm stands at ${realm}.`);
          setCharting(false);
          setDraft('');
        }
      } else if (key.backspace || key.delete) {
        setDraft((d) => d.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        setDraft((d) => d + input);
      }
      return;
    }

    if (key.upArrow || input === 'k') setCursor((c) => (c + rows.length - 1) % rows.length);
    else if (key.downArrow || input === 'j') setCursor((c) => (c + 1) % rows.length);
    else if (key.return || input === ' ') {
      const row = rows[cursor]!;
      if (row.kind === 'chart') {
        setNotice(null);
        setCharting(true);
      } else if (row.kind === 'suggested') {
        onChoose(row.repoPath);
      } else if (row.entry.exists) {
        onChoose(row.entry.repoPath);
      } else {
        setNotice(`${row.entry.repoPath} no longer stands — edit ~/.gme/config.json to forget it.`);
      }
    }
  });

  const [start, end] = scrollWindow(rows.length, cursor, LIST_HEIGHT);

  return (
    <Box flexDirection="column" paddingX={1}>
      {BANNER.map((line) => (
        <Text key={line} color={COLORS.ember}>
          {line}
        </Text>
      ))}
      <Text color={COLORS.steel}>Choose the realm to ride into.</Text>
      {notice ? (
        <Box marginTop={1}>
          <Text color={COLORS.torch}>{notice}</Text>
        </Box>
      ) : null}
      <Box marginTop={1} flexDirection="column">
        {rows.slice(start, end).map((row, i) => {
          const index = start + i;
          const chosen = index === cursor;
          const pointer = chosen ? '❯ ' : '  ';
          if (row.kind === 'suggested') {
            return (
              <Text key="suggested" color={chosen ? COLORS.gold : COLORS.steel}>
                {pointer}⚑ Quest here: {row.repoPath}
              </Text>
            );
          }
          if (row.kind === 'chart') {
            return (
              <Text key="chart" color={chosen ? COLORS.gold : COLORS.steel}>
                {pointer}✎ Chart a new realm…
              </Text>
            );
          }
          const { entry } = row;
          const name = path.basename(entry.repoPath);
          if (!entry.exists) {
            return (
              <Text key={entry.repoPath} color={COLORS.parchment} dimColor>
                {pointer}{name} ({entry.repoPath}) — realm not found
              </Text>
            );
          }
          return (
            <Box key={entry.repoPath} flexDirection="column">
              <Text color={chosen ? COLORS.gold : COLORS.parchment}>
                {pointer}{name} <Text color={COLORS.parchment}>({entry.repoPath})</Text>
              </Text>
              <Text color={COLORS.steel}>    {entryLine(entry)}</Text>
            </Box>
          );
        })}
      </Box>
      {charting ? (
        <Box marginTop={1}>
          <Text color={COLORS.banner}>Path to the new realm: </Text>
          <Text color={COLORS.gold}>{draft}</Text>
          <Text color={COLORS.parchment}>▏</Text>
        </Box>
      ) : null}
      <KeyHints
        hints={
          charting
            ? [
                { key: 'enter', does: 'chart the realm' },
                { key: 'esc', does: 'abandon the quill' },
              ]
            : [
                { key: '↑↓', does: 'choose' },
                { key: 'enter', does: 'ride forth' },
                { key: 'ctrl+c', does: 'abandon the realm' },
              ]
        }
      />
    </Box>
  );
}
