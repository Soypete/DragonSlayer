/** The squire's whisper at the bottom of every hall: what the keys do here. */

import React from 'react';
import { Box, Text } from 'ink';
import { COLORS } from '../theme.js';

export interface KeyHint {
  key: string;
  does: string;
}

export function KeyHints({ hints }: { hints: KeyHint[] }) {
  return (
    <Box marginTop={1}>
      <Text color={COLORS.parchment}>
        {hints.map((h, i) => (
          <Text key={h.key + h.does}>
            {i > 0 ? '  ·  ' : ''}
            <Text color={COLORS.banner}>{h.key}</Text> {h.does}
          </Text>
        ))}
      </Text>
    </Box>
  );
}
