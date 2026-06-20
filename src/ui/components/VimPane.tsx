/**
 * The Practice Scroll — renders a VimBuffer as the sword-school sees it:
 * every line of the scroll, the cursor as an inverted cell, and a mode line
 * that tells a novice exactly what stance the editor is in.
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { VimBuffer } from '../../types.js';
import { COLORS } from '../theme.js';

export function VimPane({ buffer }: { buffer: VimBuffer }) {
  // In visual-line mode the marked lines glow between the anchor and the cursor.
  const sel =
    buffer.mode === 'visual-line' && buffer.visualStart
      ? {
          lo: Math.min(buffer.visualStart.row, buffer.cursor.row),
          hi: Math.max(buffer.visualStart.row, buffer.cursor.row),
        }
      : null;
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={COLORS.steel} paddingX={1}>
      {buffer.lines.map((line, row) => (
        <ScrollLine
          key={row}
          line={line}
          cursorCol={row === buffer.cursor.row ? buffer.cursor.col : null}
          selected={sel !== null && row >= sel.lo && row <= sel.hi}
        />
      ))}
      <StanceLine buffer={buffer} />
    </Box>
  );
}

/** One line of the scroll; the cursor cell burns inverted, marked lines glow. */
function ScrollLine({
  line,
  cursorCol,
  selected,
}: {
  line: string;
  cursorCol: number | null;
  selected: boolean;
}) {
  // A marked (visual-line) line glows whole; the cursor cell still burns within it.
  const lineColor = selected ? COLORS.banner : COLORS.steel;
  if (cursorCol === null) {
    return (
      <Text color={lineColor} inverse={selected}>
        {line.length > 0 ? line : ' '}
      </Text>
    );
  }
  const before = line.slice(0, cursorCol);
  const under = line[cursorCol] ?? ' ';
  const after = line.slice(cursorCol + 1);
  return (
    <Text color={lineColor} inverse={selected}>
      {before}
      <Text inverse={!selected} color={COLORS.banner}>
        {under}
      </Text>
      {after}
    </Text>
  );
}

/** Which stance the blade is in — spelled out for a knight new to modes. */
function StanceLine({ buffer }: { buffer: VimBuffer }) {
  if (buffer.mode === 'insert') {
    return <Text color={COLORS.torch}>-- INSERT -- (you are writing; esc sheathes the quill)</Text>;
  }
  if (buffer.mode === 'search') {
    return (
      <Text color={COLORS.arcana}>
        /{buffer.searchDraft}
        <Text color={COLORS.parchment}> (seeking — enter leaps to the match)</Text>
      </Text>
    );
  }
  if (buffer.mode === 'visual-line') {
    const anchor = buffer.visualStart?.row ?? buffer.cursor.row;
    const span = Math.abs(buffer.cursor.row - anchor) + 1;
    return (
      <Text color={COLORS.torch}>
        -- VISUAL LINE -- ({span} line{span === 1 ? '' : 's'} marked; d/y/c strikes them, esc cancels)
      </Text>
    );
  }
  const pending = [
    buffer.pendingCount !== null ? String(buffer.pendingCount) : '',
    buffer.pendingOperator ?? '',
  ]
    .filter((p) => p.length > 0)
    .join(' ');
  const rec = buffer.recording ? `  ·  ● recording @${buffer.recording.register} (q to stop)` : '';
  return (
    <Text color={COLORS.parchment}>
      NORMAL{pending ? `  ·  half-spoken: ${pending} (awaiting a motion)` : ''}
      {rec ? <Text color={COLORS.torch}>{rec}</Text> : ''}
    </Text>
  );
}
