/**
 * The Scriptorium — where battle scrolls (typing snippets) are penned.
 *
 * Two sources of scrolls:
 *  - `snippetsFromFile`: real lines torn from the dragon's lair (the source file),
 *    chosen deterministically so the same file always yields the same scrolls.
 *  - `incantations`: test-flavored spells the knight chants to bind the dragon.
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import type { TypingSnippet } from '../types.js';

/** Hard ceiling on scroll length, per the shared contract (≤ ~180 chars). */
const MAX_SNIPPET_CHARS = 180;
/** Scrolls in this range are the most honorable duels. */
const PREFERRED_MIN = 20;
const PREFERRED_MAX = 120;
/** Anything shorter than this is not worth drawing a blade for. */
const RUNT_MIN = 8;

interface ScrollCandidate {
  text: string;
  /** 1-based line number where the candidate begins. */
  line: number;
}

/** Lines that are mere scaffolding, unworthy of battle. */
const DULL_LINE = /^(\}|\{|\)|\(|\];?|\),?;?|\};?,?|\)\};?,?|[{}()[\];,]*)$/;
const IMPORT_LINE = /^(import\b|export\s+(\*|\{[^}]*\})\s+from\b|export\s+default\s+from\b|const\s+\w+\s*=\s*require\()/;

/** Collapse leading whitespace to none and internal whitespace runs to single spaces. */
function normalizeLine(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Judge whether a (raw) line is interesting enough to duel over. */
function isWorthyLine(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return false; // blank
  if (DULL_LINE.test(trimmed)) return false; // lone braces and rubble
  if (IMPORT_LINE.test(trimmed)) return false; // imports are mere supply lines
  return normalizeLine(raw).length >= RUNT_MIN;
}

/** Derive a 32-bit seed from arbitrary content via sha1 — same scroll, same fate. */
function seedFromContent(content: string): number {
  const digest = createHash('sha1').update(content, 'utf8').digest();
  return (digest.readUInt32BE(0) ^ digest.readUInt32BE(4)) >>> 0;
}

/** mulberry32 — a tiny deterministic PRNG. No wall clocks, no true chaos. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic Fisher–Yates shuffle driven by the given PRNG. */
function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Gather 1–2 line scroll candidates from raw file content. */
function gatherCandidates(content: string): ScrollCandidate[] {
  const lines = content.split(/\r?\n/);
  const worthy: ScrollCandidate[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    if (!isWorthyLine(raw)) continue;
    worthy.push({ text: normalizeLine(raw), line: i + 1 });
  }

  const candidates: ScrollCandidate[] = [];
  for (let i = 0; i < worthy.length; i++) {
    const one = worthy[i]!;
    if (one.text.length <= MAX_SNIPPET_CHARS) candidates.push(one);
    const next = worthy[i + 1];
    if (next && next.line === one.line + 1) {
      const joined = `${one.text} ${next.text}`;
      if (joined.length <= MAX_SNIPPET_CHARS) {
        candidates.push({ text: joined, line: one.line });
      }
    }
  }
  return candidates;
}

/**
 * Pure core of `snippetsFromFile`: select up to `count` scrolls from `content`.
 * Selection is seeded by a hash of the content itself, so identical file
 * content always yields identical scrolls (saves stay stable across runs).
 * Exported for testing and for callers that already hold the content.
 */
export function selectSnippets(content: string, sourcePath: string, count: number): TypingSnippet[] {
  if (count <= 0) return [];
  const candidates = gatherCandidates(content);
  const preferred = candidates.filter(
    (c) => c.text.length >= PREFERRED_MIN && c.text.length <= PREFERRED_MAX,
  );
  const reserves = candidates.filter(
    (c) => !(c.text.length >= PREFERRED_MIN && c.text.length <= PREFERRED_MAX),
  );

  const rng = mulberry32(seedFromContent(content));
  const chosen = shuffle(preferred, rng).slice(0, count);
  if (chosen.length < count) {
    chosen.push(...shuffle(reserves, rng).slice(0, count - chosen.length));
  }

  // Present the scrolls in the order they appear in the lair.
  chosen.sort((a, b) => a.line - b.line);

  return chosen.map((c) => ({
    text: c.text,
    source: `${sourcePath}:${c.line}`,
    kind: 'code' as const,
  }));
}

/**
 * Tear up to `count` interesting 1–2 line scrolls from the file at `absPath`.
 * Skips blanks, imports, and lone braces; prefers lines of 20–120 chars;
 * leading whitespace is stripped and internal whitespace collapsed.
 * Deterministic given identical file content.
 */
export async function snippetsFromFile(absPath: string, count: number): Promise<TypingSnippet[]> {
  const content = await readFile(absPath, 'utf8');
  return selectSnippets(content, absPath, count);
}

/**
 * Test-flavored incantations aimed at a file — the spells of the coverage
 * crusade. Deterministic: same file and count, same chants.
 */
export function incantations(file: string, count: number): TypingSnippet[] {
  if (count <= 0) return [];
  const base = basename(file);
  const spells = [
    `expect(slay('${base}')).toBe(true)`,
    `describe('${base}', () => { it('holds the line', () => {`,
    `it('guards ${base} against the null drake', () => {`,
    `expect(coverageOf('${base}')).toBeGreaterThanOrEqual(100)`,
    `test('${base} survives the flaky hydra', async () => {`,
    `expect(() => breachTheGates('${base}')).not.toThrow()`,
    `const ward = await summonFixture('${base}'); expect(ward).toBeDefined()`,
    `it.each(edgeCases)('${base} repels %s', (foe) => expect(repel(foe)).toBe(true))`,
  ];
  const scrolls: TypingSnippet[] = [];
  for (let i = 0; i < count; i++) {
    scrolls.push({
      text: spells[i % spells.length]!,
      source: 'incantation',
      kind: 'incantation' as const,
    });
  }
  return scrolls;
}
