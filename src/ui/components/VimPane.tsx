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
  // Line numbers are shown 1-indexed to match the goal card ("line 4, column 3").
  const gutterWidth = String(buffer.lines.length).length;
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={COLORS.steel} paddingX={1}>
      {buffer.lines.map((line, row) => (
        <ScrollLine
          key={row}
          line={line}
          lineNo={row + 1}
          gutterWidth={gutterWidth}
          isCursorRow={row === buffer.cursor.row}
          cursorCol={row === buffer.cursor.row ? buffer.cursor.col : null}
          selected={sel !== null && row >= sel.lo && row <= sel.hi}
        />
      ))}
      <StanceLine buffer={buffer} />
    </Box>
  );
}

/** One line of the scroll: a line-number gutter, then the text; the cursor cell burns. */
function ScrollLine({
  line,
  lineNo,
  gutterWidth,
  isCursorRow,
  cursorCol,
  selected,
}: {
  line: string;
  lineNo: number;
  gutterWidth: number;
  isCursorRow: boolean;
  cursorCol: number | null;
  selected: boolean;
}) {
  // A marked (visual-line) line glows whole; the cursor cell still burns within it.
  const lineColor = selected ? COLORS.banner : COLORS.steel;
  const gutter = (
    <Text color={isCursorRow ? COLORS.banner : COLORS.parchment}>
      {String(lineNo).padStart(gutterWidth, ' ')}
      {'  '}
    </Text>
  );
  if (cursorCol === null) {
    return (
      <Text>
        {gutter}
        <Text color={lineColor} inverse={selected}>
          {line.length > 0 ? line : ' '}
        </Text>
      </Text>
    );
  }
  const before = line.slice(0, cursorCol);
  const under = line[cursorCol] ?? ' ';
  const after = line.slice(cursorCol + 1);
  return (
    <Text>
      {gutter}
      <Text color={lineColor} inverse={selected}>
        {before}
        <Text inverse={!selected} color={COLORS.banner}>
          {under}
        </Text>
        {after}
      </Text>
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
  // 1-indexed position, matching the goal card's "line 4, column 3" wording.
  const here = `  ·  line ${buffer.cursor.row + 1} · col ${buffer.cursor.col + 1}`;
  return (
    <Text color={COLORS.parchment}>
      NORMAL{pending ? `  ·  half-spoken: ${pending} (awaiting a motion)` : ''}
      <Text color={COLORS.steel}>{here}</Text>
      {rec ? <Text color={COLORS.torch}>{rec}</Text> : ''}
    </Text>
  );
}
