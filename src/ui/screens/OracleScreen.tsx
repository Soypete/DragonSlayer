/** The Oracle's Cave — a prophecy of where the worst dragons nest. */

import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { useRealmInput } from '../useRealmInput.js';
import type { Dragon, OracleProphecy, RepoScan } from '../../types.js';
import { consultOracle } from '../../ai/oracle.js';
import { COLORS } from '../theme.js';
import { KeyHints } from '../components/KeyHints.js';
import { Spinner } from '../components/Spinner.js';

export interface OracleScreenProps {
  scan: RepoScan;
  dragons: Dragon[];
  onBack: () => void;
}

export function OracleScreen({ scan, dragons, onBack }: OracleScreenProps) {
  const [prophecy, setProphecy] = useState<OracleProphecy | null>(null);

  useEffect(() => {
    let alive = true;
    // consultOracle never throws — it falls back to the heuristic seer.
    void consultOracle(scan, dragons).then((vision) => {
      if (alive) setProphecy(vision);
    });
    return () => {
      alive = false;
    };
    // One consultation per visit to the cave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealmInput((input, key) => {
    if (key.escape || input === 'o' || key.return) onBack();
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color={COLORS.arcana}>🔮 The Oracle's Cave</Text>
      {!prophecy ? (
        <Box marginTop={1}>
          <Spinner label="The oracle peers into the uncovered dark…" />
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
      <KeyHints hints={[{ key: 'esc / o', does: 'leave the cave' }]} />
    </Box>
  );
}
