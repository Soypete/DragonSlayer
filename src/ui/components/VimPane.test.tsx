import { describe, expect, it } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

import { VimPane } from './VimPane.js';
import { createVimBuffer, playKeys } from '../../vim/engine.js';

describe('VimPane', () => {
  it('numbers each line 1-indexed and reports the cursor position', () => {
    const b = playKeys(createVimBuffer(['first verse', 'second verse', 'third verse']), 'jl');
    const frame = render(<VimPane buffer={b} />).lastFrame()!;
    // Gutter shows 1-indexed line numbers (matches the goal card's wording).
    expect(frame).toContain('1');
    expect(frame).toContain('2');
    expect(frame).toContain('3');
    // Cursor on row 1 (0-indexed) col 1 → shown as line 2 · col 2.
    expect(frame).toContain('line 2 · col 2');
  });

  it('announces the visual-line selection span', () => {
    const b = playKeys(createVimBuffer(['a', 'b', 'c', 'd']), 'Vjj');
    const frame = render(<VimPane buffer={b} />).lastFrame()!;
    expect(frame).toContain('VISUAL LINE');
    expect(frame).toContain('3 lines marked');
  });
});
