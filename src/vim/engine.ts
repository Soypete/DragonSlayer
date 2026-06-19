/**
 * The Sword-School Engine — a pure modal vim interpreter for the knight's trials.
 *
 * No external editor is ever summoned: this is the game's own blade-work tutor,
 * a POSIX-vi-faithful state machine for the taught key subset. Every key press
 * is a pure function of (buffer, key) — no clocks, no dice, no mercy. The six
 * curriculum tiers it understands:
 *
 *   1. h j k l x
 *   2. w b e 0 ^ $ gg G  + count prefixes (3w, 5j)
 *   3. operators d y with motions (dw, d$, dd, yy), and p P
 *   4. insert modes i a I A o O, change c (cw, cc, c$), <esc> back to normal
 *   5. f F t T ; ,  and /term<cr> with n N
 *   6. text objects iw aw i" a" i( a( i{ a{ with c d y (ciw, di(, ya{ …)
 *
 * Anything else returns { handled: false } and leaves the scroll untouched.
 */

import type { TrialGoal, VimBuffer, VimCursor, VimKeyResult } from '../types.js';

// ── Small utilities ──────────────────────────────────────────────────────────

type Op = 'd' | 'y' | 'c';
type FindKey = 'f' | 'F' | 't' | 'T';

/** A rune is a word-rune, a sigil (punctuation), a breath (space), or void (empty line). */
type CharClass = 'word' | 'punct' | 'space' | 'empty';

const WORD_CHAR = /[A-Za-z0-9_]/;

/** Counts larger than this are folly; vi itself would also grow weary. */
const MAX_COUNT = 9999;

function classOf(ch: string | undefined): CharClass {
  if (ch === undefined || ch === '') return 'empty';
  if (/\s/.test(ch)) return 'space';
  return WORD_CHAR.test(ch) ? 'word' : 'punct';
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(n, hi));
}

/** Clamp a column to the last character of a line (vi normal-mode rule). */
function clampCol(line: string, col: number): number {
  return clamp(col, 0, Math.max(0, line.length - 1));
}

/** Column of the first non-blank rune (blank lines yield their last column). */
function firstNonBlank(line: string): number {
  const i = line.search(/\S/);
  return i === -1 ? Math.max(0, line.length - 1) : i;
}

function cmpPos(a: VimCursor, b: VimCursor): number {
  return a.row !== b.row ? a.row - b.row : a.col - b.col;
}

function samePos(a: VimCursor, b: VimCursor): boolean {
  return a.row === b.row && a.col === b.col;
}

// ── The document as a parade of positions ────────────────────────────────────
// Each line contributes one position per character; an empty line contributes a
// single 'empty' position (vi treats empty lines as words for w/b).

interface DocPos {
  row: number;
  col: number;
  cls: CharClass;
}

function docPositions(lines: string[]): DocPos[] {
  const out: DocPos[] = [];
  lines.forEach((line, row) => {
    if (line.length === 0) {
      out.push({ row, col: 0, cls: 'empty' });
      return;
    }
    for (let col = 0; col < line.length; col++) {
      out.push({ row, col, cls: classOf(line[col]) });
    }
  });
  return out;
}

function posIndex(list: DocPos[], cur: VimCursor): number {
  const i = list.findIndex((p) => p.row === cur.row && p.col === cur.col);
  return i === -1 ? 0 : i;
}

/** The last non-blank position strictly before `pos` in document order, if any. */
function lastNonBlankBefore(lines: string[], pos: VimCursor): VimCursor | null {
  const list = docPositions(lines);
  for (let j = posIndex(list, pos) - 1; j >= 0; j--) {
    const p = list[j];
    if (p.cls !== 'space' && p.cls !== 'empty') return { row: p.row, col: p.col };
  }
  return null;
}

// ── Word motions (w / b / e) ─────────────────────────────────────────────────

/** One `w` step. `hitEnd` is true when there was no next word to march to. */
function wordForward(lines: string[], cur: VimCursor): { pos: VimCursor; hitEnd: boolean } {
  const list = docPositions(lines);
  const n = list.length;
  const i = posIndex(list, cur);
  if (i >= n - 1) return { pos: cur, hitEnd: true };
  const start = list[i];
  let j = i;
  if (start.cls === 'word' || start.cls === 'punct') {
    while (j + 1 < n && list[j + 1].cls === start.cls && list[j + 1].row === start.row) j++;
  }
  j++;
  while (j < n && list[j].cls === 'space') j++;
  if (j >= n) {
    const last = list[n - 1];
    return { pos: { row: last.row, col: last.col }, hitEnd: true };
  }
  return { pos: { row: list[j].row, col: list[j].col }, hitEnd: false };
}

/** One `b` step: back to the start of the current/previous word. */
function wordBack(lines: string[], cur: VimCursor): VimCursor {
  const list = docPositions(lines);
  let j = posIndex(list, cur) - 1;
  if (j < 0) return { row: list[0].row, col: list[0].col };
  while (j > 0 && list[j].cls === 'space') j--;
  const cls = list[j].cls;
  if (cls === 'word' || cls === 'punct') {
    while (j - 1 >= 0 && list[j - 1].cls === cls && list[j - 1].row === list[j].row) j--;
  }
  return { row: list[j].row, col: list[j].col };
}

/** One `e` step: forward to the end of the current/next word (skips empty lines). */
function wordEnd(lines: string[], cur: VimCursor): VimCursor {
  const list = docPositions(lines);
  const n = list.length;
  let j = posIndex(list, cur) + 1;
  if (j >= n) return cur;
  while (j < n && (list[j].cls === 'space' || list[j].cls === 'empty')) j++;
  if (j >= n) return cur;
  while (j + 1 < n && list[j + 1].cls === list[j].cls && list[j + 1].row === list[j].row) j++;
  return { row: list[j].row, col: list[j].col };
}

/** Last column (inclusive) of the same-class run that `col` sits in. */
function endOfRun(line: string, col: number): number {
  const cls = classOf(line[col]);
  let e = col;
  while (e + 1 < line.length && classOf(line[e + 1]) === cls) e++;
  return e;
}

// ── f / F / t / T target hunting ─────────────────────────────────────────────

/**
 * Find the cursor target for an f/F/t/T strike on one line, or null if the
 * motion fails. `repeat` is true for `;`/`,` — a repeated `t`/`T` must not
 * stick on the occurrence it already sits beside, so the hunt starts one
 * rune further out.
 */
function findCharTarget(
  line: string,
  col: number,
  key: FindKey,
  char: string,
  count: number,
  repeat: boolean,
): number | null {
  const forward = key === 'f' || key === 't';
  const till = key === 't' || key === 'T';
  let remaining = count;
  if (forward) {
    const from = col + 1 + (till && repeat ? 1 : 0);
    for (let i = from; i < line.length; i++) {
      if (line[i] === char && --remaining === 0) {
        const target = till ? i - 1 : i;
        return target > col ? target : null;
      }
    }
    return null;
  }
  const from = col - 1 - (till && repeat ? 1 : 0);
  for (let i = from; i >= 0; i--) {
    if (line[i] === char && --remaining === 0) {
      const target = till ? i + 1 : i;
      return target < col ? target : null;
    }
  }
  return null;
}

function invertFind(key: FindKey): FindKey {
  switch (key) {
    case 'f':
      return 'F';
    case 'F':
      return 'f';
    case 't':
      return 'T';
    case 'T':
      return 't';
  }
}

// ── Search ───────────────────────────────────────────────────────────────────

function searchMatches(lines: string[], term: string): VimCursor[] {
  const out: VimCursor[] = [];
  lines.forEach((line, row) => {
    let idx = line.indexOf(term);
    while (idx !== -1) {
      out.push({ row, col: idx });
      idx = line.indexOf(term, idx + 1);
    }
  });
  return out;
}

/** Next (or previous) match in document order, wrapping like vi's scroll of fate. */
function findMatchFrom(lines: string[], term: string, cur: VimCursor, forward: boolean): VimCursor | null {
  const ms = searchMatches(lines, term);
  if (ms.length === 0) return null;
  if (forward) {
    for (const m of ms) if (cmpPos(m, cur) > 0) return m;
    return ms[0];
  }
  for (let i = ms.length - 1; i >= 0; i--) if (cmpPos(ms[i], cur) < 0) return ms[i];
  return ms[ms.length - 1];
}

// ── Pending-command bookkeeping ──────────────────────────────────────────────
// VimBuffer carries only `pendingOperator: string | null` and `pendingCount`,
// so multi-key commands are encoded into the pending string with this grammar:
//   [count-typed-before-operator] [d|y|c] ( [i|a] | [f|F|t|T] | g )?
// e.g. 'd' (awaiting motion), '2d' (2dw…), 'di' (awaiting text object),
// '2df' (awaiting find target), 'f' (bare find), 'g' (awaiting second g).
// Digits typed AFTER the operator live in pendingCount; the two multiply
// (vi: 2d3w slays six words).

interface Pending {
  count: number | null;
  op: Op | null;
  obj: 'i' | 'a' | null;
  find: FindKey | null;
  g: boolean;
}

const PENDING_RE = /^(\d+)?([dyc])?([ia])?([fFtT])?(g)?$/;

function parsePending(raw: string | null): Pending {
  const empty: Pending = { count: null, op: null, obj: null, find: null, g: false };
  if (!raw) return empty;
  const m = PENDING_RE.exec(raw);
  if (!m) return empty;
  return {
    count: m[1] !== undefined ? Number(m[1]) : null,
    op: (m[2] as Op | undefined) ?? null,
    obj: (m[3] as 'i' | 'a' | undefined) ?? null,
    find: (m[4] as FindKey | undefined) ?? null,
    g: m[5] !== undefined,
  };
}

function encodePending(p: Pending): string | null {
  const s = (p.count !== null ? String(p.count) : '') + (p.op ?? '') + (p.obj ?? '') + (p.find ?? '') + (p.g ? 'g' : '');
  return s === '' ? null : s;
}

/** Effective count: pre-operator count × post-operator count (each defaults to 1). */
function effCount(b: VimBuffer, p: Pending): number {
  return (p.count ?? 1) * (b.pendingCount ?? 1);
}

function hasExplicitCount(b: VimBuffer, p: Pending): boolean {
  return p.count !== null || b.pendingCount !== null;
}

// ── Result helpers ───────────────────────────────────────────────────────────

/** Command complete: clear pending state, return to normal mode (unless patched). */
function done(b: VimBuffer, patch: Partial<VimBuffer>): VimKeyResult {
  return {
    buffer: { ...b, pendingOperator: null, pendingCount: null, mode: 'normal', ...patch },
    handled: true,
  };
}

/** The key meant nothing here; the scroll is untouched. */
function unhandled(b: VimBuffer): VimKeyResult {
  return { buffer: b, handled: false };
}

/** An in-flight command was struck by a key outside the subset: abort it. */
function abortPending(b: VimBuffer): VimKeyResult {
  return {
    buffer: { ...b, pendingOperator: null, pendingCount: null, mode: 'normal' },
    handled: false,
  };
}

// ── Text surgery (pure, copy-on-write) ───────────────────────────────────────

/** Extract a character-wise range [start, end) as register pieces (one per line). */
function extractCharRange(lines: string[], start: VimCursor, end: VimCursor): string[] {
  if (start.row === end.row) return [lines[start.row].slice(start.col, end.col)];
  const pieces = [lines[start.row].slice(start.col)];
  for (let r = start.row + 1; r < end.row; r++) pieces.push(lines[r]);
  pieces.push(lines[end.row].slice(0, end.col));
  return pieces;
}

/** Remove a character-wise range [start, end), joining the severed line ends. */
function deleteCharRange(lines: string[], start: VimCursor, end: VimCursor): string[] {
  if (start.row === end.row) {
    const next = [...lines];
    next[start.row] = lines[start.row].slice(0, start.col) + lines[start.row].slice(end.col);
    return next;
  }
  const joined = lines[start.row].slice(0, start.col) + lines[end.row].slice(end.col);
  return [...lines.slice(0, start.row), joined, ...lines.slice(end.row + 1)];
}

/** Apply an operator to a character-wise span (order of a/c does not matter). */
function applyCharOperator(b: VimBuffer, op: Op, a: VimCursor, c: VimCursor): VimKeyResult {
  const [start, end] = cmpPos(a, c) <= 0 ? [a, c] : [c, a];
  if (samePos(start, end)) {
    // Empty span: nothing to cut, but `c` still draws the quill (insert mode).
    if (op === 'c') return done(b, { cursor: start, mode: 'insert' });
    return done(b, {});
  }
  const register = { text: extractCharRange(b.lines, start, end), linewise: false };
  if (op === 'y') {
    return done(b, { register, cursor: { row: start.row, col: clampCol(b.lines[start.row], start.col) } });
  }
  const lines = deleteCharRange(b.lines, start, end);
  if (op === 'c') return done(b, { lines, register, cursor: { ...start }, mode: 'insert' });
  return done(b, { lines, register, cursor: { row: start.row, col: clampCol(lines[start.row], start.col) } });
}

/** Apply an operator line-wise over rows r1..r2 (inclusive, will be clamped). */
function applyLineOperator(b: VimBuffer, op: Op, rawR1: number, rawR2: number): VimKeyResult {
  const lastRow = b.lines.length - 1;
  const r1 = clamp(Math.min(rawR1, rawR2), 0, lastRow);
  const r2 = clamp(Math.max(rawR1, rawR2), 0, lastRow);
  const register = { text: b.lines.slice(r1, r2 + 1), linewise: true };
  if (op === 'y') {
    return done(b, { register, cursor: { row: r1, col: clampCol(b.lines[r1], b.cursor.col) } });
  }
  const rest = [...b.lines.slice(0, r1), ...b.lines.slice(r2 + 1)];
  if (op === 'c') {
    const lines = [...rest.slice(0, r1), '', ...rest.slice(r1)];
    return done(b, { lines, register, cursor: { row: r1, col: 0 }, mode: 'insert' });
  }
  // dd on the last remaining line leaves one empty line — a bare castle, not a void.
  const lines = rest.length === 0 ? [''] : rest;
  const row = Math.min(r1, lines.length - 1);
  return done(b, { lines, register, cursor: { row, col: firstNonBlank(lines[row]) } });
}

// ── Motions ──────────────────────────────────────────────────────────────────

const CHAR_MOTIONS = new Set(['h', 'j', 'k', 'l', 'w', 'b', 'e', '0', '^', '$', 'G', '{', '}']);

function normalMotionCursor(b: VimBuffer, m: string, count: number, explicit: boolean): VimCursor {
  const { lines, cursor } = b;
  const lastRow = lines.length - 1;
  switch (m) {
    case 'h':
      return { row: cursor.row, col: Math.max(0, cursor.col - count) };
    case 'l':
      return { row: cursor.row, col: clampCol(lines[cursor.row], cursor.col + count) };
    case 'j': {
      const row = Math.min(lastRow, cursor.row + count);
      return { row, col: clampCol(lines[row], cursor.col) };
    }
    case 'k': {
      const row = Math.max(0, cursor.row - count);
      return { row, col: clampCol(lines[row], cursor.col) };
    }
    case '0':
      return { row: cursor.row, col: 0 };
    case '^':
      return { row: cursor.row, col: firstNonBlank(lines[cursor.row]) };
    case '$': {
      const row = Math.min(lastRow, cursor.row + count - 1);
      return { row, col: clampCol(lines[row], Number.MAX_SAFE_INTEGER) };
    }
    case 'w': {
      let p = cursor;
      for (let i = 0; i < count; i++) p = wordForward(lines, p).pos;
      return p;
    }
    case 'b': {
      let p = cursor;
      for (let i = 0; i < count; i++) p = wordBack(lines, p);
      return p;
    }
    case 'e': {
      let p = cursor;
      for (let i = 0; i < count; i++) p = wordEnd(lines, p);
      return p;
    }
    case 'G': {
      const row = explicit ? clamp(count - 1, 0, lastRow) : lastRow;
      return { row, col: firstNonBlank(lines[row]) };
    }
    case 'gg': {
      const row = explicit ? clamp(count - 1, 0, lastRow) : 0;
      return { row, col: firstNonBlank(lines[row]) };
    }
    case '}':
    case '{': {
      const row = paragraphTarget(lines, cursor.row, m === '}' ? 1 : -1, count);
      return { row, col: clampCol(lines[row], cursor.col) };
    }
  }
  return cursor;
}

/**
 * Character-wise span for operator+w, honoring vi's special cases:
 * `cw` on a non-blank behaves like `ce`, and `dw` whose motion would cross a
 * line break stops at the end of the last word moved over.
 */
function wOperatorSpan(b: VimBuffer, count: number, op: Op): { start: VimCursor; end: VimCursor } | null {
  const { lines, cursor } = b;
  const line = lines[cursor.row];
  if (op === 'c' && line.length > 0 && classOf(line[cursor.col]) !== 'space') {
    let p: VimCursor = { row: cursor.row, col: endOfRun(line, cursor.col) };
    for (let i = 1; i < count; i++) p = wordEnd(lines, p);
    return { start: cursor, end: { row: p.row, col: p.col + 1 } };
  }
  let p = cursor;
  let hitEnd = false;
  for (let i = 0; i < count; i++) {
    const step = wordForward(lines, p);
    p = step.pos;
    hitEnd = hitEnd || step.hitEnd;
  }
  if (hitEnd) return { start: cursor, end: { row: p.row, col: lines[p.row].length } };
  if (p.row === cursor.row) {
    if (p.col <= cursor.col) return null;
    return { start: cursor, end: { row: cursor.row, col: p.col } };
  }
  // Crossed a line break: halt at the end of the last word marched over.
  const back = lastNonBlankBefore(lines, p);
  if (!back || cmpPos(back, cursor) < 0) return null;
  return { start: cursor, end: { row: back.row, col: back.col + 1 } };
}

function operatorCharSpan(
  b: VimBuffer,
  m: string,
  count: number,
  op: Op,
): { start: VimCursor; end: VimCursor } | null {
  const { lines, cursor } = b;
  const line = lines[cursor.row];
  switch (m) {
    case 'h':
      return { start: { row: cursor.row, col: Math.max(0, cursor.col - count) }, end: cursor };
    case 'l':
      return { start: cursor, end: { row: cursor.row, col: Math.min(line.length, cursor.col + count) } };
    case '0':
      return { start: { row: cursor.row, col: 0 }, end: cursor };
    case '^':
      return { start: { row: cursor.row, col: firstNonBlank(line) }, end: cursor };
    case '$': {
      const row = Math.min(lines.length - 1, cursor.row + count - 1);
      return { start: cursor, end: { row, col: lines[row].length } };
    }
    case 'w':
      return wOperatorSpan(b, count, op);
    case 'e': {
      let p = cursor;
      for (let i = 0; i < count; i++) p = wordEnd(lines, p);
      if (samePos(p, cursor)) return null;
      return { start: cursor, end: { row: p.row, col: p.col + 1 } }; // inclusive motion
    }
    case 'b': {
      let p = cursor;
      for (let i = 0; i < count; i++) p = wordBack(lines, p);
      if (samePos(p, cursor)) return null;
      return { start: p, end: cursor };
    }
  }
  return null;
}

function execMotion(b: VimBuffer, pending: Pending, m: string): VimKeyResult {
  const count = effCount(b, pending);
  const explicit = hasExplicitCount(b, pending);
  const op = pending.op;
  const { cursor, lines } = b;
  const lastRow = lines.length - 1;

  if (op && (m === '{' || m === '}')) {
    // Paragraph motions act line-wise under an operator (d}, y{, c}). vi excludes
    // the blank boundary line itself, so step one line back toward the cursor —
    // except at the file edge, where the boundary is content, not a blank.
    const dir = m === '}' ? 1 : -1;
    let target = paragraphTarget(lines, cursor.row, dir, count);
    if (isBlankLine(lines[target]) && target !== cursor.row) target -= dir;
    const [lo, hi] = target < cursor.row ? [target, cursor.row] : [cursor.row, target];
    return applyLineOperator(b, op, lo, hi);
  }

  if (op && (m === 'j' || m === 'k' || m === 'G' || m === 'gg')) {
    // Line-wise operator motions.
    if (m === 'j') {
      if (cursor.row + count > lastRow) return done(b, {}); // vi: dj on the last line fails
      return applyLineOperator(b, op, cursor.row, cursor.row + count);
    }
    if (m === 'k') {
      if (cursor.row - count < 0) return done(b, {});
      return applyLineOperator(b, op, cursor.row - count, cursor.row);
    }
    if (m === 'G') {
      const target = explicit ? clamp(count - 1, 0, lastRow) : lastRow;
      return applyLineOperator(b, op, cursor.row, target);
    }
    const target = explicit ? clamp(count - 1, 0, lastRow) : 0;
    return applyLineOperator(b, op, target, cursor.row);
  }

  if (!op) return done(b, { cursor: normalMotionCursor(b, m, count, explicit) });

  const span = operatorCharSpan(b, m, count, op);
  if (!span) return done(b, {}); // recognized motion that cannot move: the blade whiffs
  return applyCharOperator(b, op, span.start, span.end);
}

// ── f/F/t/T execution ────────────────────────────────────────────────────────

function execFind(
  b: VimBuffer,
  pending: Pending,
  key: FindKey,
  char: string,
  repeat: boolean,
  record: boolean,
): VimKeyResult {
  const count = effCount(b, pending);
  const lastFind = record ? { key, char } : b.lastFind;
  const target = findCharTarget(b.lines[b.cursor.row], b.cursor.col, key, char, count, repeat);
  if (target === null) return done(b, { lastFind });
  if (!pending.op) return done(b, { cursor: { row: b.cursor.row, col: target }, lastFind });
  const forward = key === 'f' || key === 't';
  const res = forward
    ? applyCharOperator(b, pending.op, b.cursor, { row: b.cursor.row, col: target + 1 }) // inclusive
    : applyCharOperator(b, pending.op, { row: b.cursor.row, col: target }, b.cursor); // exclusive
  return { buffer: { ...res.buffer, lastFind }, handled: res.handled };
}

// ── Text objects ─────────────────────────────────────────────────────────────

function wordObjectSpan(
  lines: string[],
  cur: VimCursor,
  around: boolean,
): { start: VimCursor; end: VimCursor } | null {
  const line = lines[cur.row];
  if (line.length === 0) return null;
  const cls = classOf(line[cur.col]);
  let s = cur.col;
  let e = cur.col;
  while (s > 0 && classOf(line[s - 1]) === cls) s--;
  while (e + 1 < line.length && classOf(line[e + 1]) === cls) e++;
  if (around) {
    if (cls === 'space') {
      // aw from the breath between words swallows the following word too.
      if (e + 1 < line.length) e = endOfRun(line, e + 1);
    } else {
      let e2 = e;
      while (e2 + 1 < line.length && classOf(line[e2 + 1]) === 'space') e2++;
      if (e2 > e) e = e2;
      else while (s > 0 && classOf(line[s - 1]) === 'space') s--;
    }
  }
  return { start: { row: cur.row, col: s }, end: { row: cur.row, col: e + 1 } };
}

function quoteObjectSpan(
  lines: string[],
  cur: VimCursor,
  quote: string,
  around: boolean,
): { start: VimCursor; end: VimCursor } | null {
  const line = lines[cur.row];
  const idx: number[] = [];
  for (let i = 0; i < line.length; i++) if (line[i] === quote) idx.push(i);
  for (let k = 0; k + 1 < idx.length; k += 2) {
    const a = idx[k];
    const z = idx[k + 1];
    if (cur.col <= z) {
      return around
        ? { start: { row: cur.row, col: a }, end: { row: cur.row, col: z + 1 } }
        : { start: { row: cur.row, col: a + 1 }, end: { row: cur.row, col: z } };
    }
  }
  return null;
}

function pairObjectSpan(
  lines: string[],
  cur: VimCursor,
  open: string,
  close: string,
  around: boolean,
): { start: VimCursor; end: VimCursor } | null {
  // March backward to the enclosing opener (standing on it counts).
  let openPos: VimCursor | null = null;
  let depth = 0;
  outer: for (let r = cur.row; r >= 0; r--) {
    const line = lines[r];
    const from = r === cur.row ? Math.min(cur.col, Math.max(0, line.length - 1)) : line.length - 1;
    for (let c = from; c >= 0; c--) {
      const ch = line[c];
      const underCursor = r === cur.row && c === cur.col;
      if (ch === close && !underCursor) depth++;
      else if (ch === open) {
        if (depth === 0) {
          openPos = { row: r, col: c };
          break outer;
        }
        depth--;
      }
    }
  }
  if (!openPos) return null;
  // March forward to its matching closer.
  let closePos: VimCursor | null = null;
  depth = 0;
  outer2: for (let r = openPos.row; r < lines.length; r++) {
    const line = lines[r];
    for (let c = r === openPos.row ? openPos.col + 1 : 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === open) depth++;
      else if (ch === close) {
        if (depth === 0) {
          closePos = { row: r, col: c };
          break outer2;
        }
        depth--;
      }
    }
  }
  if (!closePos) return null;
  if (around) return { start: openPos, end: { row: closePos.row, col: closePos.col + 1 } };
  const innerStart =
    openPos.col + 1 <= lines[openPos.row].length
      ? { row: openPos.row, col: openPos.col + 1 }
      : { row: openPos.row + 1, col: 0 };
  return { start: innerStart, end: closePos };
}

/** A paragraph boundary is a blank (empty / all-whitespace) line. */
function isBlankLine(line: string): boolean {
  return line.trim().length === 0;
}

/**
 * Resolve `count` paragraph jumps from `row` in `dir` (+1 for `}`, -1 for `{`).
 * Like vi: stop on the next blank line, or the first/last line at the file's edge.
 */
function paragraphTarget(lines: string[], row: number, dir: 1 | -1, count: number): number {
  let r = row;
  const lastRow = lines.length - 1;
  for (let n = 0; n < count; n++) {
    let next = r + dir;
    while (next > 0 && next < lastRow && !isBlankLine(lines[next])) next += dir;
    r = clamp(next, 0, lastRow);
    if (r === 0 || r === lastRow) break; // edge reached; further jumps cannot move
  }
  return r;
}

/**
 * inner/around paragraph: the run of non-blank lines the cursor sits in (a run of
 * blank lines if it sits on one). `ap` also swallows the blank lines that follow
 * (or precede, at the file's end); `ip` takes the run alone.
 */
function paragraphObjectSpan(
  lines: string[],
  cur: VimCursor,
  around: boolean,
): { startRow: number; endRow: number } | null {
  const lastRow = lines.length - 1;
  const onBlank = isBlankLine(lines[cur.row]);
  let s = cur.row;
  let e = cur.row;
  while (s > 0 && isBlankLine(lines[s - 1]) === onBlank) s--;
  while (e < lastRow && isBlankLine(lines[e + 1]) === onBlank) e++;
  if (around && !onBlank) {
    let e2 = e;
    while (e2 < lastRow && isBlankLine(lines[e2 + 1])) e2++;
    if (e2 > e) e = e2;
    else while (s > 0 && isBlankLine(lines[s - 1])) s--; // no trailing blanks: take the leading ones
  }
  return { startRow: s, endRow: e };
}

function execTextObject(b: VimBuffer, pending: Pending, objChar: string): VimKeyResult {
  const op = pending.op as Op;
  const around = pending.obj === 'a';
  let span: { start: VimCursor; end: VimCursor } | null;
  if (objChar === 'w') span = wordObjectSpan(b.lines, b.cursor, around);
  else if (objChar === '"' || objChar === "'" || objChar === '`')
    span = quoteObjectSpan(b.lines, b.cursor, objChar, around);
  else if (objChar === '(' || objChar === ')' || objChar === 'b')
    span = pairObjectSpan(b.lines, b.cursor, '(', ')', around);
  else if (objChar === '{' || objChar === '}' || objChar === 'B')
    span = pairObjectSpan(b.lines, b.cursor, '{', '}', around);
  else if (objChar === 'p') {
    // Paragraph objects are line-wise (dip/dap/cip/yap), like dd's register.
    const para = paragraphObjectSpan(b.lines, b.cursor, around);
    if (!para) return done(b, {});
    return applyLineOperator(b, op, para.startRow, para.endRow);
  } else return abortPending(b);
  if (!span) return done(b, {}); // recognized object, nothing to seize
  return applyCharOperator(b, op, span.start, span.end);
}

// ── Plain normal-mode commands ───────────────────────────────────────────────

function execX(b: VimBuffer): VimKeyResult {
  const count = b.pendingCount ?? 1;
  const line = b.lines[b.cursor.row];
  if (line.length === 0) return done(b, {}); // x on an empty line: the blade meets only air
  return applyCharOperator(b, 'd', b.cursor, {
    row: b.cursor.row,
    col: Math.min(line.length, b.cursor.col + count),
  });
}

function execPaste(b: VimBuffer, after: boolean): VimKeyResult {
  if (!b.register) return done(b, {}); // an empty satchel pastes nothing
  const count = b.pendingCount ?? 1;
  const { text, linewise } = b.register;
  const { lines, cursor } = b;
  if (linewise) {
    const at = after ? cursor.row + 1 : cursor.row;
    const block: string[] = [];
    for (let i = 0; i < count; i++) block.push(...text);
    const next = [...lines.slice(0, at), ...block, ...lines.slice(at)];
    return done(b, { lines: next, cursor: { row: at, col: firstNonBlank(next[at]) } });
  }
  const line = lines[cursor.row];
  const at = after && line.length > 0 ? cursor.col + 1 : cursor.col;
  if (text.length === 1) {
    const str = text[0].repeat(count);
    if (str === '') return done(b, {});
    const next = [...lines];
    next[cursor.row] = line.slice(0, at) + str + line.slice(at);
    return done(b, { lines: next, cursor: { row: cursor.row, col: at + str.length - 1 } });
  }
  // Multi-piece character-wise paste: splice the lines apart (count is ignored here).
  const head = line.slice(0, at);
  const tail = line.slice(at);
  const next = [
    ...lines.slice(0, cursor.row),
    head + text[0],
    ...text.slice(1, -1),
    text[text.length - 1] + tail,
    ...lines.slice(cursor.row + 1),
  ];
  return done(b, { lines: next, cursor: { row: cursor.row, col: clampCol(next[cursor.row], at) } });
}

function enterInsert(b: VimBuffer, key: string): VimKeyResult {
  const { lines, cursor } = b;
  const line = lines[cursor.row];
  switch (key) {
    case 'i':
      return done(b, { mode: 'insert' });
    case 'a':
      return done(b, {
        mode: 'insert',
        cursor: { row: cursor.row, col: line.length === 0 ? 0 : cursor.col + 1 },
      });
    case 'I':
      return done(b, { mode: 'insert', cursor: { row: cursor.row, col: firstNonBlank(line) } });
    case 'A':
      return done(b, { mode: 'insert', cursor: { row: cursor.row, col: line.length } });
    case 'o': {
      const next = [...lines.slice(0, cursor.row + 1), '', ...lines.slice(cursor.row + 1)];
      return done(b, { lines: next, mode: 'insert', cursor: { row: cursor.row + 1, col: 0 } });
    }
    case 'O': {
      const next = [...lines.slice(0, cursor.row), '', ...lines.slice(cursor.row)];
      return done(b, { lines: next, mode: 'insert', cursor: { row: cursor.row, col: 0 } });
    }
  }
  return unhandled(b);
}

function execSearchRepeat(b: VimBuffer, forward: boolean): VimKeyResult {
  if (!b.searchTerm) return done(b, {}); // no incantation has been spoken yet
  const hit = findMatchFrom(b.lines, b.searchTerm, b.cursor, forward);
  return done(b, { cursor: hit ?? b.cursor });
}

// ── Mode handlers ────────────────────────────────────────────────────────────

function normalKey(b: VimBuffer, key: string): VimKeyResult {
  const pending = parsePending(b.pendingOperator);

  if (key === '<esc>') {
    if (b.pendingOperator !== null || b.pendingCount !== null) return done(b, {});
    return unhandled(b);
  }

  // A find (f/F/t/T) awaits its quarry: the very next key is the target rune.
  if (pending.find) {
    if (key.length !== 1) return abortPending(b);
    return execFind(b, pending, pending.find, key, false, true);
  }

  // A text object (di…, ca…) awaits its object rune.
  if (pending.obj && pending.op) {
    if (key.length !== 1) return abortPending(b);
    return execTextObject(b, pending, key);
  }

  // A lone `g` awaits its twin.
  if (pending.g) {
    if (key === 'g') return execMotion(b, pending, 'gg');
    return abortPending(b);
  }

  // Count digits ('0' only continues a count; alone it is a motion).
  if (/^[0-9]$/.test(key) && !(key === '0' && b.pendingCount === null)) {
    const next = Math.min((b.pendingCount ?? 0) * 10 + Number(key), MAX_COUNT);
    return { buffer: { ...b, pendingCount: next }, handled: true };
  }

  // Operators.
  if (key === 'd' || key === 'y' || key === 'c') {
    if (pending.op === key) {
      // Doubled operator (dd / yy / cc): line-wise over count lines.
      return applyLineOperator(b, key, b.cursor.row, b.cursor.row + effCount(b, pending) - 1);
    }
    if (pending.op) return abortPending(b); // `dy` and kin: the stances clash
    const enc = encodePending({ count: b.pendingCount, op: key, obj: null, find: null, g: false });
    return {
      buffer: { ...b, pendingOperator: enc, pendingCount: null, mode: 'operator-pending' },
      handled: true,
    };
  }

  // Text-object openers — only meaningful while an operator waits.
  if ((key === 'i' || key === 'a') && pending.op) {
    return {
      buffer: { ...b, pendingOperator: encodePending({ ...pending, obj: key }), mode: 'operator-pending' },
      handled: true,
    };
  }

  // Find openers.
  if (key === 'f' || key === 'F' || key === 't' || key === 'T') {
    return {
      buffer: { ...b, pendingOperator: encodePending({ ...pending, find: key }), mode: 'operator-pending' },
      handled: true,
    };
  }

  // `g` prefix (gg, dgg…).
  if (key === 'g') {
    return {
      buffer: { ...b, pendingOperator: encodePending({ ...pending, g: true }), mode: 'operator-pending' },
      handled: true,
    };
  }

  // Repeat the last find, forward (;) or reversed (,).
  if (key === ';' || key === ',') {
    if (!b.lastFind) return done(b, {});
    const k = key === ';' ? b.lastFind.key : invertFind(b.lastFind.key);
    return execFind(b, pending, k, b.lastFind.char, true, false);
  }

  if (CHAR_MOTIONS.has(key)) return execMotion(b, pending, key);

  // Anything below is not a motion: it cannot serve an awaiting operator.
  if (pending.op) return abortPending(b);

  switch (key) {
    case 'x':
      return execX(b);
    case 'p':
      return execPaste(b, true);
    case 'P':
      return execPaste(b, false);
    case 'i':
    case 'a':
    case 'I':
    case 'A':
    case 'o':
    case 'O':
      return enterInsert(b, key);
    case '/':
      return {
        buffer: { ...b, mode: 'search', searchDraft: '', pendingOperator: null, pendingCount: null },
        handled: true,
      };
    case 'n':
      return execSearchRepeat(b, true);
    case 'N':
      return execSearchRepeat(b, false);
  }
  return unhandled(b);
}

function insertKey(b: VimBuffer, key: string): VimKeyResult {
  const { lines, cursor } = b;
  const line = lines[cursor.row];
  if (key === '<esc>') {
    // Sheathe the quill: back to normal mode, cursor steps one left (vi rule).
    const col = Math.max(0, Math.min(cursor.col - 1, line.length - 1));
    return { buffer: { ...b, mode: 'normal', cursor: { row: cursor.row, col } }, handled: true };
  }
  if (key === '<cr>') {
    const next = [
      ...lines.slice(0, cursor.row),
      line.slice(0, cursor.col),
      line.slice(cursor.col),
      ...lines.slice(cursor.row + 1),
    ];
    return { buffer: { ...b, lines: next, cursor: { row: cursor.row + 1, col: 0 } }, handled: true };
  }
  if (key === '<bs>') {
    if (cursor.col > 0) {
      const next = [...lines];
      next[cursor.row] = line.slice(0, cursor.col - 1) + line.slice(cursor.col);
      return { buffer: { ...b, lines: next, cursor: { row: cursor.row, col: cursor.col - 1 } }, handled: true };
    }
    if (cursor.row > 0) {
      const prev = lines[cursor.row - 1];
      const next = [...lines.slice(0, cursor.row - 1), prev + line, ...lines.slice(cursor.row + 1)];
      return { buffer: { ...b, lines: next, cursor: { row: cursor.row - 1, col: prev.length } }, handled: true };
    }
    return { buffer: b, handled: true }; // top-left: nothing left to unwrite
  }
  if (key.length === 1) {
    const next = [...lines];
    next[cursor.row] = line.slice(0, cursor.col) + key + line.slice(cursor.col);
    return { buffer: { ...b, lines: next, cursor: { row: cursor.row, col: cursor.col + 1 } }, handled: true };
  }
  return unhandled(b);
}

function searchKey(b: VimBuffer, key: string): VimKeyResult {
  if (key === '<esc>') {
    return { buffer: { ...b, mode: 'normal', searchDraft: '' }, handled: true };
  }
  if (key === '<bs>') {
    if (b.searchDraft.length === 0) {
      return { buffer: { ...b, mode: 'normal' }, handled: true }; // erased past the slash
    }
    return { buffer: { ...b, searchDraft: b.searchDraft.slice(0, -1) }, handled: true };
  }
  if (key === '<cr>') {
    // An empty incantation repeats the previous one, as vi decrees.
    const term = b.searchDraft.length > 0 ? b.searchDraft : b.searchTerm;
    if (!term) return { buffer: { ...b, mode: 'normal', searchDraft: '' }, handled: true };
    const hit = findMatchFrom(b.lines, term, b.cursor, true);
    return {
      buffer: { ...b, mode: 'normal', searchDraft: '', searchTerm: term, cursor: hit ?? b.cursor },
      handled: true,
    };
  }
  if (key.length === 1) {
    return { buffer: { ...b, searchDraft: b.searchDraft + key }, handled: true };
  }
  return unhandled(b);
}

// ── Public ritual ────────────────────────────────────────────────────────────

/**
 * Forge a fresh buffer for a trial. Lines are copied; the cursor (default 0,0)
 * is clamped to legal normal-mode ground. An empty scroll becomes [''].
 */
export function createVimBuffer(lines: string[], cursor?: VimCursor): VimBuffer {
  const safe = lines.length === 0 ? [''] : [...lines];
  const row = clamp(cursor?.row ?? 0, 0, safe.length - 1);
  const col = clampCol(safe[row], cursor?.col ?? 0);
  return {
    lines: safe,
    cursor: { row, col },
    mode: 'normal',
    pendingOperator: null,
    pendingCount: null,
    register: null,
    searchTerm: null,
    searchDraft: '',
    lastFind: null,
  };
}

/**
 * Feed one key to the interpreter. `key` is a single character or one of the
 * tokens `<esc>`, `<cr>`, `<bs>`. Pure: the input buffer is never mutated.
 * Keys outside the taught subset return { handled: false } with the text and
 * cursor untouched (an in-flight operator/count is aborted, as vi would).
 */
export function vimKey(buffer: VimBuffer, key: string): VimKeyResult {
  switch (buffer.mode) {
    case 'insert':
      return insertKey(buffer, key);
    case 'search':
      return searchKey(buffer, key);
    default:
      return normalKey(buffer, key);
  }
}

/** Has the knight fulfilled the trial's demand? */
export function goalMet(buffer: VimBuffer, goal: TrialGoal): boolean {
  if (goal.kind === 'cursor') {
    return buffer.cursor.row === goal.row && buffer.cursor.col === goal.col;
  }
  return (
    buffer.lines.length === goal.lines.length && buffer.lines.every((line, i) => line === goal.lines[i])
  );
}

const KEY_TOKENS = ['<esc>', '<cr>', '<bs>'] as const;

/**
 * Parse a keystroke scripture like "3wciwhydra<esc>" into individual keys.
 * Tokens are matched case-insensitively and normalized to lowercase; a `<`
 * that does not begin a known token is a literal key.
 */
export function keysFromString(seq: string): string[] {
  const keys: string[] = [];
  let i = 0;
  while (i < seq.length) {
    if (seq[i] === '<') {
      const token = KEY_TOKENS.find((t) => seq.slice(i, i + t.length).toLowerCase() === t);
      if (token) {
        keys.push(token);
        i += token.length;
        continue;
      }
    }
    keys.push(seq[i]);
    i++;
  }
  return keys;
}

/**
 * Convenience for demos and parSolution validation: replay a whole sequence
 * (string or pre-parsed keys) and return the final buffer.
 */
export function playKeys(buffer: VimBuffer, keys: string | string[]): VimBuffer {
  const list = typeof keys === 'string' ? keysFromString(keys) : keys;
  return list.reduce((b, k) => vimKey(b, k).buffer, buffer);
}
