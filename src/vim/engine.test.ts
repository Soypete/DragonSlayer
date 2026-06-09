import { describe, expect, it } from 'vitest';

import type { VimBuffer, VimCursor } from '../types.js';
import { createVimBuffer, goalMet, keysFromString, playKeys, vimKey } from './engine.js';

/** Forge a buffer and replay a keystroke scripture through the engine. */
function run(lines: string[], keys: string, cursor?: VimCursor): VimBuffer {
  return playKeys(createVimBuffer(lines, cursor), keys);
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    for (const v of Object.values(o)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
}

// ── createVimBuffer ──────────────────────────────────────────────────────────

describe('createVimBuffer', () => {
  it('forges a normal-mode buffer at the gate (0,0)', () => {
    const b = createVimBuffer(['slay the drake']);
    expect(b.cursor).toEqual({ row: 0, col: 0 });
    expect(b.mode).toBe('normal');
    expect(b.pendingOperator).toBeNull();
    expect(b.pendingCount).toBeNull();
    expect(b.register).toBeNull();
    expect(b.searchTerm).toBeNull();
    expect(b.searchDraft).toBe('');
    expect(b.lastFind).toBeNull();
  });

  it('honors a starting cursor', () => {
    expect(createVimBuffer(['ab', 'cd'], { row: 1, col: 1 }).cursor).toEqual({ row: 1, col: 1 });
  });

  it('clamps a wild starting cursor to legal ground', () => {
    expect(createVimBuffer(['ab'], { row: 9, col: 9 }).cursor).toEqual({ row: 0, col: 1 });
    expect(createVimBuffer([''], { row: 0, col: 5 }).cursor).toEqual({ row: 0, col: 0 });
  });

  it('turns an empty scroll into a single empty line', () => {
    expect(createVimBuffer([]).lines).toEqual(['']);
  });

  it('copies the lines so the caller array stays untouched', () => {
    const src = ['a'];
    const b = createVimBuffer(src);
    src.push('b');
    expect(b.lines).toEqual(['a']);
  });
});

// ── keysFromString ───────────────────────────────────────────────────────────

describe('keysFromString', () => {
  it('splits plain characters', () => {
    expect(keysFromString('hjkl')).toEqual(['h', 'j', 'k', 'l']);
  });

  it('parses the demo scripture "3wciwhydra<esc>"', () => {
    expect(keysFromString('3wciwhydra<esc>')).toEqual([
      '3', 'w', 'c', 'i', 'w', 'h', 'y', 'd', 'r', 'a', '<esc>',
    ]);
  });

  it('recognizes every token', () => {
    expect(keysFromString('<esc><cr><bs>')).toEqual(['<esc>', '<cr>', '<bs>']);
  });

  it('matches tokens case-insensitively, normalizing to lowercase', () => {
    expect(keysFromString('i<Esc>A<CR><BS>')).toEqual(['i', '<esc>', 'A', '<cr>', '<bs>']);
  });

  it('treats a lone < (or an unknown <...>) as literal keys', () => {
    expect(keysFromString('a<b')).toEqual(['a', '<', 'b']);
    expect(keysFromString('i<wat>')).toEqual(['i', '<', 'w', 'a', 't', '>']);
  });

  it('round-trips: joined keys reproduce the (lowercased-token) sequence', () => {
    const seq = '3wciwhydra<esc>o new line<esc>/drake<cr>n';
    expect(keysFromString(seq).join('')).toBe(seq);
  });

  it('handles search incantations with digits and spaces', () => {
    expect(keysFromString('/po 3<cr>')).toEqual(['/', 'p', 'o', ' ', '3', '<cr>']);
  });
});

// ── Tier 1: h j k l x ────────────────────────────────────────────────────────

describe('tier 1 — h j k l x', () => {
  it('l marches right, h retreats left', () => {
    expect(run(['drake'], 'll').cursor).toEqual({ row: 0, col: 2 });
    expect(run(['drake'], 'llh').cursor).toEqual({ row: 0, col: 1 });
  });

  it('l clamps at the last character (vi normal-mode wall)', () => {
    expect(run(['ab'], 'lllll').cursor).toEqual({ row: 0, col: 1 });
  });

  it('h clamps at column 0', () => {
    expect(run(['ab'], 'hhh').cursor).toEqual({ row: 0, col: 0 });
  });

  it('j and k climb between lines and clamp at the ramparts', () => {
    expect(run(['a', 'b', 'c'], 'jj').cursor).toEqual({ row: 2, col: 0 });
    expect(run(['a', 'b', 'c'], 'jjjj').cursor).toEqual({ row: 2, col: 0 });
    expect(run(['a', 'b', 'c'], 'jk').cursor).toEqual({ row: 0, col: 0 });
    expect(run(['a', 'b'], 'kk').cursor).toEqual({ row: 0, col: 0 });
  });

  it('j onto a shorter line clamps the column', () => {
    expect(run(['slay a drake', 'ox'], 'j', { row: 0, col: 10 }).cursor).toEqual({ row: 1, col: 1 });
  });

  it('j onto an empty line lands on column 0', () => {
    expect(run(['slay', ''], 'j', { row: 0, col: 3 }).cursor).toEqual({ row: 1, col: 0 });
  });

  it('x severs the character under the cursor into the register', () => {
    const b = run(['drake'], 'x');
    expect(b.lines).toEqual(['rake']);
    expect(b.cursor).toEqual({ row: 0, col: 0 });
    expect(b.register).toEqual({ text: ['d'], linewise: false });
  });

  it('x at the last character pulls the cursor back', () => {
    expect(run(['ab'], 'x', { row: 0, col: 1 }).lines).toEqual(['a']);
    expect(run(['ab'], 'x', { row: 0, col: 1 }).cursor).toEqual({ row: 0, col: 0 });
  });

  it('x on an empty line is a no-op (the blade meets only air)', () => {
    const b = createVimBuffer(['']);
    const r = vimKey(b, 'x');
    expect(r.handled).toBe(true);
    expect(r.buffer.lines).toEqual(['']);
    expect(r.buffer.register).toBeNull();
  });

  it('3x severs three characters; a huge count clamps to the line end', () => {
    expect(run(['drake'], '3x').lines).toEqual(['ke']);
    expect(run(['abc'], '9x').lines).toEqual(['']);
  });

  it('xp performs the classic character swap', () => {
    expect(run(['ab'], 'xp').lines).toEqual(['ba']);
  });
});

// ── Tier 2: word motions, line anchors, counts ───────────────────────────────

describe('tier 2 — w b e 0 ^ $ gg G and counts', () => {
  it('w hops to the next word start', () => {
    expect(run(['slay the drake'], 'w').cursor).toEqual({ row: 0, col: 5 });
    expect(run(['slay the drake'], 'ww').cursor).toEqual({ row: 0, col: 9 });
  });

  it('w treats punctuation as its own word (vi word classes)', () => {
    expect(run(['slay(drake)'], 'w').cursor).toEqual({ row: 0, col: 4 });
    expect(run(['slay(drake)'], 'ww').cursor).toEqual({ row: 0, col: 5 });
    expect(run(['slay(drake)'], 'www').cursor).toEqual({ row: 0, col: 10 });
  });

  it('underscores belong to the word', () => {
    expect(run(['fire_brand ho'], 'w').cursor).toEqual({ row: 0, col: 11 });
  });

  it('w crosses line breaks and stops on empty lines', () => {
    expect(run(['slay', 'drake'], 'w').cursor).toEqual({ row: 1, col: 0 });
    expect(run(['slay', '', 'drake'], 'w').cursor).toEqual({ row: 1, col: 0 });
    expect(run(['slay', '', 'drake'], 'ww').cursor).toEqual({ row: 2, col: 0 });
  });

  it('w at the last word halts on the final character', () => {
    expect(run(['slay the'], 'w', { row: 0, col: 5 }).cursor).toEqual({ row: 0, col: 7 });
  });

  it('b retreats to word starts, even across lines', () => {
    expect(run(['slay the drake'], 'b', { row: 0, col: 11 }).cursor).toEqual({ row: 0, col: 9 });
    expect(run(['slay the drake'], 'bb', { row: 0, col: 11 }).cursor).toEqual({ row: 0, col: 5 });
    expect(run(['slay', 'drake'], 'b', { row: 1, col: 0 }).cursor).toEqual({ row: 0, col: 0 });
    expect(run(['slay'], 'b').cursor).toEqual({ row: 0, col: 0 });
  });

  it('b stops on empty lines', () => {
    expect(run(['slay', '', 'drake'], 'b', { row: 2, col: 0 }).cursor).toEqual({ row: 1, col: 0 });
  });

  it('e advances to word ends', () => {
    expect(run(['slay the drake'], 'e').cursor).toEqual({ row: 0, col: 3 });
    expect(run(['slay the drake'], 'ee').cursor).toEqual({ row: 0, col: 7 });
    expect(run(['slay the drake'], 'e', { row: 0, col: 3 }).cursor).toEqual({ row: 0, col: 7 });
  });

  it('e skips empty lines (unlike w)', () => {
    expect(run(['slay', '', 'drake'], 'e', { row: 0, col: 3 }).cursor).toEqual({ row: 2, col: 4 });
  });

  it('e at the end of the realm holds its ground', () => {
    expect(run(['slay'], 'e', { row: 0, col: 3 }).cursor).toEqual({ row: 0, col: 3 });
  });

  it('0 charges to column 0, ^ to the first non-blank, $ to the line end', () => {
    expect(run(['  forge ahead'], '0', { row: 0, col: 8 }).cursor).toEqual({ row: 0, col: 0 });
    expect(run(['  forge ahead'], '^', { row: 0, col: 8 }).cursor).toEqual({ row: 0, col: 2 });
    expect(run(['  forge ahead'], '$').cursor).toEqual({ row: 0, col: 12 });
  });

  it('counts multiply motions: 3w, 2b, 2e', () => {
    expect(run(['one two three four'], '3w').cursor).toEqual({ row: 0, col: 14 });
    expect(run(['one two three four'], '2b', { row: 0, col: 14 }).cursor).toEqual({ row: 0, col: 4 });
    expect(run(['one two three'], '2e').cursor).toEqual({ row: 0, col: 6 });
  });

  it('counts past the buffer end clamp safely (5j, 99w, 99l)', () => {
    expect(run(['a', 'b', 'c'], '5j').cursor).toEqual({ row: 2, col: 0 });
    expect(run(['one two'], '99w').cursor).toEqual({ row: 0, col: 6 });
    expect(run(['abc'], '99l').cursor).toEqual({ row: 0, col: 2 });
  });

  it('gg and G land on the first non-blank of their line', () => {
    expect(run(['  top', 'mid', '  low'], 'G').cursor).toEqual({ row: 2, col: 2 });
    expect(run(['  top', 'mid', '  low'], 'gg', { row: 2, col: 0 }).cursor).toEqual({ row: 0, col: 2 });
  });

  it('counted gg/G jump to that line (1-indexed), clamped', () => {
    expect(run(['a', 'b', 'c'], '2G').cursor).toEqual({ row: 1, col: 0 });
    expect(run(['a', 'b', 'c'], '3gg').cursor).toEqual({ row: 2, col: 0 });
    expect(run(['a', 'b', 'c'], '99G').cursor).toEqual({ row: 2, col: 0 });
    expect(run(['a', 'b', 'c'], '1G', { row: 2, col: 0 }).cursor).toEqual({ row: 0, col: 0 });
  });

  it('0 inside a count is a digit, alone it is a motion', () => {
    expect(run(['aaaaaaaaaaaa'], '10l').cursor).toEqual({ row: 0, col: 10 });
    expect(run(['aaaaaaaaaaaa'], '10l0').cursor).toEqual({ row: 0, col: 0 });
  });

  it('count accumulation caps at 9999 (no runaway sieges)', () => {
    const b = run(['a'], '99999');
    expect(b.pendingCount).toBe(9999);
  });

  it('$ with a count descends count-1 lines first', () => {
    expect(run(['abc', 'defgh'], '2$').cursor).toEqual({ row: 1, col: 4 });
  });
});

// ── Tier 3: d / y operators, p / P ───────────────────────────────────────────

describe('tier 3 — delete, yank, put', () => {
  it('dw deletes to the next word start', () => {
    const b = run(['slay the drake'], 'dw');
    expect(b.lines).toEqual(['the drake']);
    expect(b.register).toEqual({ text: ['slay '], linewise: false });
    expect(b.cursor).toEqual({ row: 0, col: 0 });
  });

  it('dw stops at punctuation', () => {
    expect(run(['slay(now)'], 'dw').lines).toEqual(['(now)']);
  });

  it('dw on the last word of a line stops at the line end (vi special case)', () => {
    const b = run(['slay the'], 'dw', { row: 0, col: 5 });
    expect(b.lines).toEqual(['slay ']);
    expect(b.cursor).toEqual({ row: 0, col: 4 });
  });

  it('dw whose motion crosses a line break never eats the newline', () => {
    expect(run(['slay the', 'drake'], 'dw', { row: 0, col: 5 }).lines).toEqual(['slay ', 'drake']);
    expect(run(['slay the', 'drake'], 'd2w').lines).toEqual(['', 'drake']);
  });

  it('dw on an empty line is a no-op (deliberate simplification)', () => {
    expect(run(['', 'drake'], 'dw').lines).toEqual(['', 'drake']);
  });

  it('counts compose with operators: d2w, 2dw, and 2d3w slays six words', () => {
    expect(run(['one two three four'], 'd2w').lines).toEqual(['three four']);
    expect(run(['one two three four'], '2dw').lines).toEqual(['three four']);
    expect(run(['a b c d e f g'], '2d3w').lines).toEqual(['g']);
  });

  it('d$ cleaves to the end of the line, d0 back to its start', () => {
    expect(run(['slay the drake'], 'd$', { row: 0, col: 5 }).lines).toEqual(['slay ']);
    expect(run(['slay the drake'], 'd0', { row: 0, col: 5 }).lines).toEqual(['the drake']);
  });

  it('d^ deletes back to the first non-blank', () => {
    expect(run(['  abc def'], 'd^', { row: 0, col: 6 }).lines).toEqual(['  def']);
  });

  it('de is inclusive of the word end; db cuts backward', () => {
    expect(run(['slay the'], 'de').lines).toEqual([' the']);
    expect(run(['slay the'], 'db', { row: 0, col: 5 }).lines).toEqual(['the']);
  });

  it('db from a line start reaches into the previous line', () => {
    expect(run(['slay', 'the'], 'db', { row: 1, col: 0 }).lines).toEqual(['the']);
  });

  it('d2e can cross lines char-wise, joining the severed ends', () => {
    expect(run(['ab cd', 'ef'], 'd2e', { row: 0, col: 3 }).lines).toEqual(['ab ']);
  });

  it('dl and dh slice single characters', () => {
    expect(run(['abc'], 'dl').lines).toEqual(['bc']);
    expect(run(['abc'], 'dh', { row: 0, col: 1 }).lines).toEqual(['bc']);
  });

  it('dd removes the line, cursor to first non-blank below', () => {
    const b = run(['a', 'b', '  c'], 'dd', { row: 1, col: 0 });
    expect(b.lines).toEqual(['a', '  c']);
    expect(b.cursor).toEqual({ row: 1, col: 2 });
    expect(b.register).toEqual({ text: ['b'], linewise: true });
  });

  it('dd on the last line steps the cursor up', () => {
    expect(run(['a', 'b', 'c'], 'dd', { row: 2, col: 0 }).lines).toEqual(['a', 'b']);
    expect(run(['a', 'b', 'c'], 'dd', { row: 2, col: 0 }).cursor).toEqual({ row: 1, col: 0 });
  });

  it('dd on the last remaining line leaves one empty line', () => {
    const b = run(['only'], 'dd');
    expect(b.lines).toEqual(['']);
    expect(b.cursor).toEqual({ row: 0, col: 0 });
    expect(b.register).toEqual({ text: ['only'], linewise: true });
  });

  it('2dd reaps two lines; overlong counts clamp', () => {
    expect(run(['a', 'b', 'c'], '2dd').lines).toEqual(['c']);
    expect(run(['a', 'b'], '5dd').lines).toEqual(['']);
  });

  it('dj reaps this line and the next; dj on the last line whiffs', () => {
    expect(run(['a', 'b', 'c'], 'dj').lines).toEqual(['c']);
    expect(run(['a', 'b', 'c'], 'dj', { row: 2, col: 0 }).lines).toEqual(['a', 'b', 'c']);
  });

  it('dk reaps this line and the one above', () => {
    expect(run(['a', 'b', 'c'], 'dk', { row: 1, col: 0 }).lines).toEqual(['c']);
  });

  it('dG reaps to the last line; dgg to the first', () => {
    expect(run(['a', 'b', 'c'], 'dG', { row: 1, col: 0 }).lines).toEqual(['a']);
    expect(run(['a', 'b', 'c'], 'dgg', { row: 1, col: 0 }).lines).toEqual(['c']);
  });

  it('yy then p duplicates the line below; P above', () => {
    expect(run(['forge'], 'yyp').lines).toEqual(['forge', 'forge']);
    expect(run(['forge', 'keep'], 'yyP').lines).toEqual(['forge', 'forge', 'keep']);
  });

  it('line-wise p lands on the first non-blank of the pasted line', () => {
    expect(run(['  ax'], 'yyp').cursor).toEqual({ row: 1, col: 2 });
  });

  it('dd then p performs the classic line swap', () => {
    expect(run(['a', 'b'], 'ddp').lines).toEqual(['b', 'a']);
    expect(run(['a', 'b'], 'ddP', { row: 1, col: 0 }).lines).toEqual(['b', 'a']);
  });

  it('char-wise p pastes after the cursor; P at the cursor', () => {
    expect(run(['ab cd'], 'ywP').lines).toEqual(['ab ab cd']);
    const b = run(['abc'], 'yllp'); // yank 'a', move right, paste after 'b'
    expect(b.lines).toEqual(['abac']);
    expect(b.cursor).toEqual({ row: 0, col: 2 });
  });

  it('char-wise p on an empty line pastes at column 0', () => {
    expect(run(['ab', ''], 'ywjp').lines).toEqual(['ab', 'ab']);
  });

  it('counted puts repeat the goods: yy2p, x3p', () => {
    expect(run(['x'], 'yy2p').lines).toEqual(['x', 'x', 'x']);
    expect(run(['ab'], 'x3p').lines).toEqual(['baaa']);
  });

  it('p with an empty satchel is a harmless no-op', () => {
    const r = vimKey(createVimBuffer(['ab']), 'p');
    expect(r.handled).toBe(true);
    expect(r.buffer.lines).toEqual(['ab']);
  });

  it('yank does not scar the text and keeps the cursor at the span start', () => {
    const b = run(['slay the'], 'yw');
    expect(b.lines).toEqual(['slay the']);
    expect(b.cursor).toEqual({ row: 0, col: 0 });
    expect(b.register).toEqual({ text: ['slay '], linewise: false });
  });

  it('yb pulls the cursor back to the start of the yank', () => {
    expect(run(['slay the'], 'yb', { row: 0, col: 5 }).cursor).toEqual({ row: 0, col: 0 });
  });

  it('dw then P restores the realm', () => {
    expect(run(['slay the'], 'dwP').lines).toEqual(['slay the']);
  });

  it('y2j yanks three lines line-wise without moving text', () => {
    const b = run(['a', 'b', 'c'], 'y2j');
    expect(b.lines).toEqual(['a', 'b', 'c']);
    expect(b.register).toEqual({ text: ['a', 'b', 'c'], linewise: true });
  });
});

// ── Tier 4: insert modes and change ──────────────────────────────────────────

describe('tier 4 — i a I A o O and c', () => {
  it('i inserts before the cursor; <esc> steps back left', () => {
    const b = run(['drake'], 'iax<esc>');
    expect(b.lines).toEqual(['axdrake']);
    expect(b.mode).toBe('normal');
    expect(b.cursor).toEqual({ row: 0, col: 1 });
  });

  it('a appends after the cursor', () => {
    expect(run(['ab'], 'aX<esc>').lines).toEqual(['aXb']);
  });

  it('a on an empty line writes at column 0', () => {
    expect(run([''], 'aX<esc>').lines).toEqual(['X']);
  });

  it('I leaps to the first non-blank, A to the line end', () => {
    expect(run(['  ab'], 'IX<esc>', { row: 0, col: 3 }).lines).toEqual(['  Xab']);
    expect(run(['ab'], 'AX<esc>').lines).toEqual(['abX']);
  });

  it('o opens a line below, O above', () => {
    expect(run(['a', 'b'], 'oX<esc>').lines).toEqual(['a', 'X', 'b']);
    expect(run(['a', 'b'], 'OX<esc>').lines).toEqual(['X', 'a', 'b']);
  });

  it('<esc> from insert at column 0 stays put; after A it lands on the last char', () => {
    expect(run(['ab'], 'i<esc>').cursor).toEqual({ row: 0, col: 0 });
    expect(run(['ab'], 'A<esc>').cursor).toEqual({ row: 0, col: 1 });
  });

  it('cw on a word behaves like ce: the trailing space survives', () => {
    expect(run(['slay drake'], 'cwforge<esc>').lines).toEqual(['forge drake']);
  });

  it('cw on the last character of a word changes only that character', () => {
    expect(run(['ab cd'], 'cwX<esc>', { row: 0, col: 1 }).lines).toEqual(['aX cd']);
  });

  it('cw on punctuation changes the punctuation run', () => {
    expect(run(['a..b'], 'cwX<esc>', { row: 0, col: 1 }).lines).toEqual(['aXb']);
  });

  it('cw on whitespace deletes just the whitespace', () => {
    expect(run(['a  b'], 'cwX<esc>', { row: 0, col: 1 }).lines).toEqual(['aXb']);
  });

  it('c2w changes two words', () => {
    expect(run(['one two three'], 'c2wX<esc>').lines).toEqual(['X three']);
  });

  it('c$ rewrites to the end of the line', () => {
    expect(run(['slay the'], 'c$X<esc>', { row: 0, col: 5 }).lines).toEqual(['slay X']);
  });

  it('cc razes the whole line and opens insert mode at column 0', () => {
    const mid = run(['  old'], 'cc');
    expect(mid.mode).toBe('insert');
    expect(mid.cursor).toEqual({ row: 0, col: 0 });
    expect(run(['  old'], 'ccnew<esc>').lines).toEqual(['new']);
  });

  it('c leaves the deleted text in the register', () => {
    expect(run(['slay drake'], 'cwX<esc>').register).toEqual({ text: ['slay'], linewise: false });
  });

  it('<cr> in insert mode splits the line at the quill', () => {
    const b = run(['abcd'], 'i<cr>', { row: 0, col: 2 });
    expect(b.lines).toEqual(['ab', 'cd']);
    expect(b.cursor).toEqual({ row: 1, col: 0 });
    expect(b.mode).toBe('insert');
  });

  it('<bs> in insert mode unwrites the previous character', () => {
    expect(run(['abc'], 'iXY<bs><esc>').lines).toEqual(['Xabc']);
  });

  it('<bs> at column 0 joins with the line above', () => {
    const b = run(['ab', 'cd'], 'i<bs>', { row: 1, col: 0 });
    expect(b.lines).toEqual(['abcd']);
    expect(b.cursor).toEqual({ row: 0, col: 2 });
  });

  it('<bs> at the very top-left has nothing to unwrite', () => {
    const b = createVimBuffer(['ab']);
    const r = vimKey(vimKey(b, 'i').buffer, '<bs>');
    expect(r.handled).toBe(true);
    expect(r.buffer.lines).toEqual(['ab']);
  });
});

// ── Tier 5: f F t T ; , and /search n N ──────────────────────────────────────

describe('tier 5 — character hunts and search', () => {
  it('f leaps onto the character; 2f onto the second occurrence', () => {
    expect(run(['slay.the.drake'], 'f.').cursor).toEqual({ row: 0, col: 4 });
    expect(run(['slay.the.drake'], '2f.').cursor).toEqual({ row: 0, col: 8 });
  });

  it('a fruitless f stays put (and is still a handled command)', () => {
    const r = vimKey(createVimBuffer(['slay']), 'f');
    const r2 = vimKey(r.buffer, 'z');
    expect(r2.handled).toBe(true);
    expect(r2.buffer.cursor).toEqual({ row: 0, col: 0 });
    expect(r2.buffer.pendingOperator).toBeNull();
  });

  it('F hunts backward, t stops one short, T one after (backward)', () => {
    expect(run(['slay.the'], 'F.', { row: 0, col: 7 }).cursor).toEqual({ row: 0, col: 4 });
    expect(run(['ab.cd'], 't.').cursor).toEqual({ row: 0, col: 1 });
    expect(run(['ab.cd'], 'T.', { row: 0, col: 4 }).cursor).toEqual({ row: 0, col: 3 });
  });

  it('f records the hunt for ; and ,', () => {
    const b = run(['a.b.c'], 'f.');
    expect(b.lastFind).toEqual({ key: 'f', char: '.' });
    expect(playKeys(b, ';').cursor).toEqual({ row: 0, col: 3 });
    expect(playKeys(b, ';,').cursor).toEqual({ row: 0, col: 1 });
  });

  it('repeated ; after t does not stick (the classic vi trap)', () => {
    const b = run(['ab.cd.ef'], 't.');
    expect(b.cursor).toEqual({ row: 0, col: 1 });
    const once = playKeys(b, ';');
    expect(once.cursor).toEqual({ row: 0, col: 4 });
    expect(playKeys(once, ';').cursor).toEqual({ row: 0, col: 4 }); // no third dot
  });

  it(', after t reverses without sticking either', () => {
    const b = run(['ab.cd.ef'], 't.;');
    expect(playKeys(b, ',').cursor).toEqual({ row: 0, col: 3 });
  });

  it('; with no hunt on record is a polite no-op', () => {
    const r = vimKey(createVimBuffer(['ab']), ';');
    expect(r.handled).toBe(true);
    expect(r.buffer.cursor).toEqual({ row: 0, col: 0 });
  });

  it('dt deletes up to (not including) the target; df includes it', () => {
    expect(run(['slay.the'], 'dt.').lines).toEqual(['.the']);
    expect(run(['slay.the'], 'df.').lines).toEqual(['the']);
  });

  it('dF deletes backward including the target, excluding the cursor char', () => {
    expect(run(['slay.the'], 'dF.', { row: 0, col: 7 }).lines).toEqual(['slaye']);
  });

  it('tx when the target is adjacent does not move (vi), but ; then advances', () => {
    const b = run(['a..b.c'], 't.', { row: 0, col: 1 }); // '.' is right next door
    expect(b.cursor).toEqual({ row: 0, col: 1 });
    expect(playKeys(b, ';').cursor).toEqual({ row: 0, col: 3 });
  });

  it('/term<cr> flies to the next match', () => {
    const b = run(['the drake sleeps', 'a drake wakes'], '/drake<cr>');
    expect(b.cursor).toEqual({ row: 0, col: 4 });
    expect(b.mode).toBe('normal');
    expect(b.searchTerm).toBe('drake');
  });

  it('the search draft is visible while typing and edits with <bs>', () => {
    const typing = run(['x'], '/dra');
    expect(typing.mode).toBe('search');
    expect(typing.searchDraft).toBe('dra');
    expect(playKeys(typing, '<bs>').searchDraft).toBe('dr');
  });

  it('<esc> abandons the search; <bs> past the slash does too', () => {
    expect(run(['x'], '/dra<esc>').mode).toBe('normal');
    expect(run(['x'], '/dra<esc>').searchDraft).toBe('');
    expect(run(['x'], '/<bs>').mode).toBe('normal');
  });

  it('n marches to the next match and wraps; N retreats', () => {
    const b = run(['the drake sleeps', 'a drake wakes'], '/drake<cr>');
    const n1 = playKeys(b, 'n');
    expect(n1.cursor).toEqual({ row: 1, col: 2 });
    expect(playKeys(n1, 'n').cursor).toEqual({ row: 0, col: 4 }); // wrapped
    expect(playKeys(b, 'N').cursor).toEqual({ row: 1, col: 2 }); // wrapped backward
  });

  it('an empty / repeats the previous incantation (wrapping)', () => {
    const first = run(['drake drake'], '/drake<cr>');
    expect(first.cursor).toEqual({ row: 0, col: 6 }); // skips the match underfoot
    expect(playKeys(first, '/<cr>').cursor).toEqual({ row: 0, col: 0 }); // wraps home
  });

  it('a search with no match leaves the cursor be', () => {
    expect(run(['castle'], '/dragon<cr>').cursor).toEqual({ row: 0, col: 0 });
  });

  it('n before any incantation is a no-op', () => {
    const r = vimKey(createVimBuffer(['x y']), 'n');
    expect(r.handled).toBe(true);
    expect(r.buffer.cursor).toEqual({ row: 0, col: 0 });
  });

  it('search matches later on the same line', () => {
    expect(run(['x drake'], '/drake<cr>').cursor).toEqual({ row: 0, col: 2 });
  });
});

// ── Tier 6: text objects ─────────────────────────────────────────────────────

describe('tier 6 — text objects with c d y', () => {
  it('ciw rewrites the word under the cursor, wherever within it', () => {
    expect(run(['slay the drake'], 'ciwfoe<esc>', { row: 0, col: 5 }).lines).toEqual(['slay foe drake']);
    expect(run(['slay the drake'], 'ciwfoe<esc>', { row: 0, col: 7 }).lines).toEqual(['slay foe drake']);
  });

  it('diw leaves both flanking spaces; daw eats the trailing one', () => {
    expect(run(['slay the drake'], 'diw', { row: 0, col: 5 }).lines).toEqual(['slay  drake']);
    expect(run(['slay the drake'], 'daw', { row: 0, col: 5 }).lines).toEqual(['slay drake']);
  });

  it('daw at the line end takes the leading space instead', () => {
    expect(run(['slay the'], 'daw', { row: 0, col: 6 }).lines).toEqual(['slay']);
  });

  it('iw on whitespace selects the whitespace run; aw adds the next word', () => {
    expect(run(['a   b'], 'diw', { row: 0, col: 2 }).lines).toEqual(['ab']);
    expect(run(['a  bc'], 'daw', { row: 0, col: 1 }).lines).toEqual(['a']);
  });

  it('iw on a punctuation run stays within it', () => {
    expect(run(['a==b'], 'diw', { row: 0, col: 1 }).lines).toEqual(['ab']);
  });

  it('diw on an empty line has nothing to seize', () => {
    expect(run([''], 'diw').lines).toEqual(['']);
  });

  it('yiw then P clones the word', () => {
    expect(run(['drake '], 'yiwP').lines).toEqual(['drakedrake ']);
  });

  it('ci" rewrites inside the quotes, even from before them', () => {
    expect(run(['say "old words" now'], 'ci"new<esc>').lines).toEqual(['say "new" now']);
    expect(run(['say "old words" now'], 'ci"new<esc>', { row: 0, col: 7 }).lines).toEqual(['say "new" now']);
  });

  it('di" and da" (quotes included)', () => {
    expect(run(['say "old" now'], 'di"', { row: 0, col: 6 }).lines).toEqual(['say "" now']);
    expect(run(['say "old" now'], 'da"', { row: 0, col: 6 }).lines).toEqual(['say  now']);
  });

  it('ci" on empty quotes simply opens insert between them', () => {
    expect(run(['x ""'], 'ci"hi<esc>').lines).toEqual(['x "hi"']);
  });

  it('quote pairing is sequential: the cursor picks its own pair', () => {
    expect(run(['"a" "b"'], 'ci"X<esc>', { row: 0, col: 4 }).lines).toEqual(['"a" "X"']);
  });

  it('i" with no pair in reach is a no-op', () => {
    expect(run(['no quotes "here'], 'di"', { row: 0, col: 12 }).lines).toEqual(['no quotes "here']);
  });

  it('di( honors nesting from inside, on the opener, and on the closer', () => {
    expect(run(['fn(a(b)c)'], 'di(', { row: 0, col: 5 }).lines).toEqual(['fn(a()c)']);
    expect(run(['fn(a(b)c)'], 'di(', { row: 0, col: 4 }).lines).toEqual(['fn(a()c)']);
    expect(run(['fn(a(b)c)'], 'di(', { row: 0, col: 6 }).lines).toEqual(['fn(a()c)']);
    expect(run(['fn(a(b)c)'], 'di(', { row: 0, col: 3 }).lines).toEqual(['fn()']);
  });

  it('da( removes the brackets too', () => {
    expect(run(['fn(a(b)c)'], 'da(', { row: 0, col: 5 }).lines).toEqual(['fn(ac)']);
  });

  it('di{ reaches across lines and joins the husk', () => {
    const b = run(['castle {', '  keep,', '  moat', '}'], 'di{', { row: 1, col: 3 });
    expect(b.lines).toEqual(['castle {}']);
  });

  it('ya{ yanks the braced block, brackets included, text unscarred', () => {
    const b = run(['a {b} c'], 'ya{', { row: 0, col: 3 });
    expect(b.lines).toEqual(['a {b} c']);
    expect(b.register).toEqual({ text: ['{b}'], linewise: false });
  });

  it('yi( yanks the innards char-wise', () => {
    expect(run(['f(ab)'], 'yi(', { row: 0, col: 2 }).register).toEqual({ text: ['ab'], linewise: false });
  });

  it('i( with no enclosing pair is a no-op (even with a pair further right)', () => {
    expect(run(['x (a)'], 'di(').lines).toEqual(['x (a)']);
  });

  it('an unknown object rune aborts the command, unhandled', () => {
    let b = createVimBuffer(['ab']);
    b = vimKey(b, 'd').buffer;
    b = vimKey(b, 'i').buffer;
    const r = vimKey(b, 'z');
    expect(r.handled).toBe(false);
    expect(r.buffer.pendingOperator).toBeNull();
    expect(r.buffer.lines).toEqual(['ab']);
  });
});

// ── Pending state, modes, and unhandled keys ─────────────────────────────────

describe('pending state and the unhandled', () => {
  it('an operator awaits in operator-pending mode', () => {
    const r = vimKey(createVimBuffer(['ab']), 'd');
    expect(r.handled).toBe(true);
    expect(r.buffer.mode).toBe('operator-pending');
    expect(r.buffer.pendingOperator).toBe('d');
  });

  it('a count typed before the operator is folded into it (2d → "2d")', () => {
    const b = run(['a', 'b', 'c'], '2d');
    expect(b.pendingOperator).toBe('2d');
    expect(b.pendingCount).toBeNull();
  });

  it('<esc> cancels pending operators and counts', () => {
    const b = run(['a'], '2d<esc>');
    expect(b.pendingOperator).toBeNull();
    expect(b.pendingCount).toBeNull();
    expect(b.mode).toBe('normal');
  });

  it('<esc> with nothing pending is a wasted keystroke', () => {
    expect(vimKey(createVimBuffer(['a']), '<esc>').handled).toBe(false);
  });

  it('an unknown key in normal mode is unhandled and changes nothing', () => {
    const b = createVimBuffer(['ab']);
    const r = vimKey(b, 'q');
    expect(r.handled).toBe(false);
    expect(r.buffer).toBe(b); // the very same scroll
  });

  it('an unknown key after an operator aborts it, unhandled', () => {
    const r = vimKey(vimKey(createVimBuffer(['ab']), 'd').buffer, 'z');
    expect(r.handled).toBe(false);
    expect(r.buffer.pendingOperator).toBeNull();
    expect(r.buffer.lines).toEqual(['ab']);
  });

  it('clashing operators (dy) abort, unhandled', () => {
    const r = vimKey(vimKey(createVimBuffer(['ab']), 'd').buffer, 'y');
    expect(r.handled).toBe(false);
    expect(r.buffer.pendingOperator).toBeNull();
  });

  it('x cannot serve as a motion for d', () => {
    const r = vimKey(vimKey(createVimBuffer(['ab']), 'd').buffer, 'x');
    expect(r.handled).toBe(false);
    expect(r.buffer.lines).toEqual(['ab']);
  });

  it('<cr> means nothing in normal mode', () => {
    expect(vimKey(createVimBuffer(['ab']), '<cr>').handled).toBe(false);
  });

  it('unknown tokens in insert mode are unhandled', () => {
    const b = vimKey(createVimBuffer(['ab']), 'i').buffer;
    expect(vimKey(b, '<f1>').handled).toBe(false);
  });

  it('a stray g followed by a non-g aborts, unhandled', () => {
    const r = vimKey(vimKey(createVimBuffer(['ab']), 'g').buffer, 'x');
    expect(r.handled).toBe(false);
    expect(r.buffer.pendingOperator).toBeNull();
  });

  it('the engine never mutates the buffer it is given', () => {
    const cases: Array<[string[], string, VimCursor | undefined]> = [
      [['a', 'b'], 'dd', undefined],
      [['slay the'], 'ciwfoo<esc>', { row: 0, col: 5 }],
      [['x'], 'yyp', undefined],
      [['abc'], 'i<cr>Z<bs><esc>', { row: 0, col: 1 }],
      [['drake here'], '/drake<cr>n', undefined],
    ];
    for (const [lines, keys, cursor] of cases) {
      let b = deepFreeze(createVimBuffer(lines, cursor));
      for (const k of keysFromString(keys)) {
        b = deepFreeze(vimKey(b, k).buffer); // a mutation would throw in strict mode
      }
    }
  });
});

// ── goalMet ──────────────────────────────────────────────────────────────────

describe('goalMet', () => {
  it('judges cursor goals', () => {
    const b = run(['slay the'], 'w');
    expect(goalMet(b, { kind: 'cursor', row: 0, col: 5 })).toBe(true);
    expect(goalMet(b, { kind: 'cursor', row: 0, col: 4 })).toBe(false);
  });

  it('judges text goals line by line', () => {
    const b = run(['slay the drake'], 'dw');
    expect(goalMet(b, { kind: 'text', lines: ['the drake'] })).toBe(true);
    expect(goalMet(b, { kind: 'text', lines: ['the drake', ''] })).toBe(false);
    expect(goalMet(b, { kind: 'text', lines: ['the drak'] })).toBe(false);
  });
});

// ── Full quests: multi-key sequences end to end ──────────────────────────────

describe('integration — whole sword forms', () => {
  it('"3wciwhydra<esc>" renames the wyrm', () => {
    const keys = keysFromString('3wciwhydra<esc>');
    expect(keys).toHaveLength(11);
    let b = createVimBuffer(['slay the foul wyrm of regret']);
    for (const k of keys) {
      const r = vimKey(b, k);
      expect(r.handled).toBe(true); // a par solution wastes no keystrokes
      b = r.buffer;
    }
    expect(goalMet(b, { kind: 'text', lines: ['slay the foul hydra of regret'] })).toBe(true);
    expect(b.mode).toBe('normal');
  });

  it('search, then strike: "/moat<cr>x"', () => {
    const b = run(['the moat is deep'], '/moat<cr>x');
    expect(b.lines).toEqual(['the oat is deep']);
  });

  it('harvest and replant a line: "yyjp"', () => {
    expect(run(['torch', 'gate'], 'yyjp').lines).toEqual(['torch', 'gate', 'torch']);
  });

  it('ggdG razes the whole castle to one empty line', () => {
    const b = run(['a', 'b', 'c'], 'ggdG', { row: 1, col: 0 });
    expect(b.lines).toEqual(['']);
  });

  it('f then ci( — hunt the bracket, rewrite the innards', () => {
    const b = run(['brew(nettle, fang)'], 'f(ci(moss<esc>');
    expect(b.lines).toEqual(['brew(moss)']);
  });

  it('o then text then <esc> then dd undoes the addition', () => {
    expect(run(['keep'], 'onew<esc>dd').lines).toEqual(['keep']);
  });

  it('change inside quotes after a search', () => {
    const b = run(['ale "flat" ale', 'mead "fizzy" mead'], '/fizzy<cr>ci"flat<esc>');
    expect(b.lines).toEqual(['ale "flat" ale', 'mead "flat" mead']);
  });
});
