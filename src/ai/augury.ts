/// <reference types="node" />
/**
 * The Daily Augury — the Oracle's Cave grants ONE true consultation per real
 * calendar day.
 *
 * Judgment is pure arithmetic over the metric deltas since the last augury
 * (coverage trend, test-file count, dragons slain): improvement → blessing,
 * decay → curse, first visit → a neutral omen. The flavor proclamation and
 * the style EDICT are asked of the `claude` CLI (same summons as the oracle:
 * `claude -p ... --output-format json`); when the seer is absent, tardy, or
 * incoherent we fall back — silently, as is tradition — to a deterministic
 * template pool keyed by the augury's kind and its focus metric.
 *
 * Edicts are agent style law: they are inscribed into a marker-fenced managed
 * block in the target repo's CLAUDE.md and AGENTS.md, so the player's normal
 * coding sessions live under the cave's mandate until the next dawn.
 */

import { execFile } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Augury, AuguryKind, RepoScan } from '../types.js';

/** The metric snapshot the cave records at each consultation. */
export type AugurySnapshot = Augury['snapshot'];

/** The verdict of the cave before any words are chosen. */
export interface AuguryJudgment {
  kind: AuguryKind;
  /** Defined only when a previous augury stood to be honored (or not). */
  honored?: boolean;
}

/** Which front of the war an edict aims its discipline at. */
export type EdictFocus = 'coveragePct' | 'testFiles' | 'dragonsSlain';

/** Cap on the oracle's breath (stdout), lest she flood the cave. */
const MAX_ORACLE_BREATH_BYTES = 1024 * 1024;

/** The fence around the managed edict block in CLAUDE.md / AGENTS.md. */
export const EDICT_START_MARKER = '<!-- gme:oracle-edict:start -->';
export const EDICT_END_MARKER = '<!-- gme:oracle-edict:end -->';

/** The harness instruction files the edict is inscribed into. */
const EDICT_SCROLLS = ['CLAUDE.md', 'AGENTS.md'] as const;

// ── Judgment (pure) ──────────────────────────────────────────────────────────

/**
 * Weigh the realm's fortunes against the last augury. Deterministic:
 * - first visit → 'omen';
 * - any metric improved and none decayed → 'blessing';
 * - any metric decayed → 'curse';
 * - nothing moved → another 'omen' (the smoke refuses to settle).
 *
 * `honored` is judged whenever a previous augury stood: did the metric its
 * edict named improve while the edict was law?
 */
export function judgeAugury(
  prev: Augury | undefined,
  snapshot: AugurySnapshot,
  _today: string,
): AuguryJudgment {
  if (prev === undefined) return { kind: 'omen' };

  const deltas = [
    snapshot.coveragePct - prev.snapshot.coveragePct,
    snapshot.testFiles - prev.snapshot.testFiles,
    snapshot.dragonsSlain - prev.snapshot.dragonsSlain,
  ];
  const anyDecay = deltas.some((d) => d < 0);
  const anyGain = deltas.some((d) => d > 0);
  const kind: AuguryKind = anyDecay ? 'curse' : anyGain ? 'blessing' : 'omen';

  const focus = edictFocus(prev.kind, prev.snapshot);
  const honored = snapshot[focus] > prev.snapshot[focus];
  return { kind, honored };
}

/**
 * The metric an augury's edict trains its eye on. Deterministic from the
 * kind and the snapshot at issuance, so tomorrow's judge can re-derive it.
 * Curses and omens aim at the weakest front; blessings praise the strongest.
 */
export function edictFocus(kind: AuguryKind, snapshot: AugurySnapshot): EdictFocus {
  if (kind === 'blessing') {
    if (snapshot.coveragePct >= 80) return 'coveragePct';
    if (snapshot.dragonsSlain > 0) return 'dragonsSlain';
    if (snapshot.testFiles > 0) return 'testFiles';
    return 'coveragePct';
  }
  if (snapshot.testFiles === 0) return 'testFiles';
  if (snapshot.coveragePct < 50) return 'coveragePct';
  if (snapshot.dragonsSlain === 0) return 'dragonsSlain';
  return 'coveragePct';
}

/** The cave speaks once per calendar day; same-day revisits find only silence. */
export function canConsult(prev: Augury | undefined, today: string): boolean {
  return prev === undefined || prev.date !== today;
}

// ── Consulting the cave ──────────────────────────────────────────────────────

/**
 * Perform the daily augury. Judgment is computed deterministically; only the
 * WORDS (proclamation + edict) are asked of the `claude` CLI. Never throws:
 * any misfortune collapses into the deterministic template pool.
 */
export async function consultAugury(
  prev: Augury | undefined,
  snapshot: AugurySnapshot,
  today: string,
  scanContext: RepoScan,
  timeoutMs = 30000,
): Promise<Augury> {
  const judgment = judgeAugury(prev, snapshot, today);
  try {
    const utterance = await summonClaude(
      composePlea(judgment, prev, snapshot, scanContext),
      timeoutMs,
    );
    const envelope = JSON.parse(utterance) as { result?: unknown };
    if (typeof envelope.result !== 'string') {
      return fallbackAugury(judgment, snapshot, today);
    }
    const words = extractAuguryJson(envelope.result);
    if (words === null) return fallbackAugury(judgment, snapshot, today);
    return forgeAugury(judgment, snapshot, today, words, 'claude');
  } catch {
    // The seer was absent, tardy, or incomprehensible. The templates abide.
    return fallbackAugury(judgment, snapshot, today);
  }
}

/**
 * The deterministic augury, spoken when the seer will not. Templates are
 * keyed by the augury's kind and its focus metric; the day's date seeds the
 * pick, so each dawn brings fresh words yet the same dawn always brings the
 * same ones.
 */
export function fallbackAugury(
  judgment: AuguryJudgment,
  snapshot: AugurySnapshot,
  today: string,
): Augury {
  const focus = edictFocus(judgment.kind, snapshot);
  const edicts = EDICT_POOL[judgment.kind][focus];
  const proclamations = PROCLAMATION_POOL[judgment.kind];
  const seed = fnv1a(`${today}|${judgment.kind}|${focus}`);
  const words = {
    proclamation: proclamations[seed % proclamations.length](snapshot, judgment),
    edict: edicts[seed % edicts.length],
  };
  return forgeAugury(judgment, snapshot, today, words, 'fallback');
}

interface AuguryWords {
  proclamation: string;
  edict: string;
}

/** Stamp judgment + words + snapshot into the final augury record. */
function forgeAugury(
  judgment: AuguryJudgment,
  snapshot: AugurySnapshot,
  today: string,
  words: AuguryWords,
  source: Augury['source'],
): Augury {
  const augury: Augury = {
    date: today,
    kind: judgment.kind,
    edict: words.edict,
    proclamation: words.proclamation,
    snapshot: { ...snapshot },
    source,
  };
  if (judgment.honored !== undefined) augury.honored = judgment.honored;
  return augury;
}

/** Run the claude CLI directly (no shell), resolving with its stdout. */
function summonClaude(plea: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'claude',
      ['-p', plea, '--output-format', 'json'],
      { timeout: timeoutMs, maxBuffer: MAX_ORACLE_BREATH_BYTES },
      (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout);
      },
    );
  });
}

/** Compose the plea laid at the cave mouth: judgment is settled, words are not. */
function composePlea(
  judgment: AuguryJudgment,
  prev: Augury | undefined,
  snapshot: AugurySnapshot,
  scan: RepoScan,
): string {
  const focus = edictFocus(judgment.kind, snapshot);
  const before = prev
    ? `coverage ${prev.snapshot.coveragePct}%, ${prev.snapshot.testFiles} test files, ${prev.snapshot.dragonsSlain} dragons slain`
    : 'no prior augury (first visit)';
  return [
    'You are the Oracle of a fantasy RPG about code reliability. Bugs are dragons;',
    'tests are wards. The daily augury has already been JUDGED — you only choose the words.',
    '',
    `Repo: ${scan.repoPath} (${scan.sourceFiles.length} source files, ${scan.testFiles.length} test files).`,
    `Before: ${before}.`,
    `Now: coverage ${snapshot.coveragePct}%, ${snapshot.testFiles} test files, ${snapshot.dragonsSlain} dragons slain.`,
    `Verdict: ${judgment.kind.toUpperCase()}. Focus metric: ${focus}.`,
    '',
    'Respond with ONLY a JSON object, no prose, of the shape:',
    '{"proclamation":"<2-3 dramatic oracle sentences delivering the verdict>","edict":"<one coding-style directive>"}',
    '',
    'The edict will be written into the repo\'s shared CLAUDE.md/AGENTS.md, so it must',
    'read as a legitimate, concrete professional engineering style directive a teammate',
    'could follow without confusion — NO fantasy flavor in the edict. A curse mandates',
    'discipline (e.g. strict test-first, every mock must justify itself); a blessing',
    'encourages good habits (e.g. table-driven tests named for the behavior they guard);',
    'an omen sets a sensible baseline practice.',
  ].join('\n');
}

// ── Reading the entrails (JSON extraction) ───────────────────────────────────

/**
 * Pull {proclamation, edict} out of the oracle's raw utterance. Tolerates
 * fenced code blocks and stray prose around the braces. Returns null when no
 * well-formed augury can be divined.
 */
export function extractAuguryJson(utterance: string): AuguryWords | null {
  for (const rune of candidateRunes(utterance)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rune);
    } catch {
      continue;
    }
    const words = sanctifyWords(parsed);
    if (words !== null) return words;
  }
  return null;
}

/** Candidate JSON texts hidden in the utterance, most-likely first. */
function* candidateRunes(utterance: string): Generator<string> {
  const trimmed = utterance.trim();
  if (trimmed.length === 0) return;
  yield trimmed;

  const fences = trimmed.matchAll(/```(?:json)?\s*\n?([\s\S]*?)```/gi);
  for (const fence of fences) {
    const body = fence[1].trim();
    if (body.length > 0) yield body;
  }

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last > first) yield trimmed.slice(first, last + 1);
}

/** Validate an arbitrary parsed value into augury words, or reject it (null). */
function sanctifyWords(parsed: unknown): AuguryWords | null {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const { proclamation, edict } = parsed as Record<string, unknown>;
  if (typeof proclamation !== 'string' || proclamation.trim().length === 0) return null;
  if (typeof edict !== 'string' || edict.trim().length === 0) return null;
  return { proclamation: proclamation.trim(), edict: edict.trim() };
}

// ── Inscribing the edict (marker-fenced managed block) ───────────────────────

/**
 * Write (or replace) ONLY the marker-fenced edict block in the target repo's
 * CLAUDE.md and AGENTS.md. Creates a file holding just the block when absent;
 * appends the block when the file exists without one; rewrites strictly the
 * span between (and including) the markers otherwise. Content outside the
 * markers is never touched. Returns the absolute paths written.
 */
export function inscribeEdict(repoPath: string, augury: Augury): string[] {
  const block = renderEdictBlock(augury);
  const written: string[] = [];
  for (const scroll of EDICT_SCROLLS) {
    const path = join(repoPath, scroll);
    if (!existsSync(path)) {
      writeFileSync(path, `${block}\n`, 'utf8');
      written.push(path);
      continue;
    }
    const content = readFileSync(path, 'utf8');
    const span = findEdictSpan(content);
    const next =
      span === null
        ? `${content}${content.endsWith('\n') ? '' : '\n'}\n${block}\n`
        : content.slice(0, span.start) + block + content.slice(span.end);
    writeFileSync(path, next, 'utf8');
    written.push(path);
  }
  return written;
}

/**
 * Remove the managed edict block from CLAUDE.md and AGENTS.md. A file is
 * deleted only when the block was its entire content; otherwise the block is
 * excised and everything outside the markers is preserved untouched.
 */
export function clearEdict(repoPath: string): void {
  for (const scroll of EDICT_SCROLLS) {
    const path = join(repoPath, scroll);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, 'utf8');
    const span = findEdictSpan(content);
    if (span === null) continue;
    let end = span.end;
    if (content[end] === '\n') end += 1; // take the block's own trailing newline
    const remainder = content.slice(0, span.start) + content.slice(end);
    if (remainder.trim().length === 0) {
      unlinkSync(path);
    } else {
      writeFileSync(path, remainder, 'utf8');
    }
  }
}

/** Render the managed block, markers included. */
export function renderEdictBlock(augury: Augury): string {
  const heading =
    augury.kind === 'blessing'
      ? "Oracle's Blessing"
      : augury.kind === 'curse'
        ? "Oracle's Curse"
        : "Oracle's Omen";
  return [
    EDICT_START_MARKER,
    '<!-- Managed by gme (Dragonslayer). This block is rewritten daily; edit outside it only. -->',
    '',
    `## ${heading} — edict of ${augury.date}`,
    '',
    augury.edict,
    '',
    EDICT_END_MARKER,
  ].join('\n');
}

/** Locate the fenced block: [start of start-marker, end of end-marker). */
function findEdictSpan(content: string): { start: number; end: number } | null {
  const start = content.indexOf(EDICT_START_MARKER);
  if (start === -1) return null;
  const endMarkerAt = content.indexOf(EDICT_END_MARKER, start + EDICT_START_MARKER.length);
  if (endMarkerAt === -1) return null;
  return { start, end: endMarkerAt + EDICT_END_MARKER.length };
}

// ── The template pools ───────────────────────────────────────────────────────

type ProclamationForge = (snapshot: AugurySnapshot, judgment: AuguryJudgment) => string;

/** Honored-curse redemption coda, appended when yesterday's law was kept. */
function honoredCoda(judgment: AuguryJudgment): string {
  if (judgment.honored === true) {
    return ' The cave notes that yesterday\'s edict was honored; redemption is recorded in the ledger.';
  }
  if (judgment.honored === false) {
    return ' Yesterday\'s edict went unhonored; the cave remembers.';
  }
  return '';
}

const PROCLAMATION_POOL: Record<AuguryKind, ProclamationForge[]> = {
  blessing: [
    (s, j) =>
      `The cave fills with golden light. Since last you knelt here the wards have grown — ` +
      `${s.coveragePct}% of the realm's lines now stand defended, ${s.testFiles} ward-scrolls in the armory, ` +
      `${s.dragonsSlain} dragons returned to dust. The Oracle smiles upon your blade.${honoredCoda(j)}`,
    (s, j) =>
      `Warm wind rises from the deep, smelling of forge-fire and victory. The auguries read plainly: ` +
      `the realm is safer than it was at your last visit (${s.coveragePct}% warded, ${s.dragonsSlain} slain). ` +
      `Carry this blessing — and the edict that rides with it.${honoredCoda(j)}`,
    (s, j) =>
      `The smoke parts and shows green fields where lairs once smoldered. ${s.coveragePct}% of the lines ` +
      `lie under ward and the dragon-count of the fallen stands at ${s.dragonsSlain}. The Oracle pronounces ` +
      `a blessing upon the day's work.${honoredCoda(j)}`,
  ],
  curse: [
    (s, j) =>
      `Cold wind snakes through the cave and the torches gutter. The wards have THINNED since your last ` +
      `visit — only ${s.coveragePct}% of the realm's lines stand defended — and the dragons grow bold. ` +
      `The Oracle's eyes narrow: discipline, knight, or ruin.${honoredCoda(j)}`,
    (s, j) =>
      `The smoke curdles black. Ground once won has been surrendered, and the auguries name it plainly: ` +
      `decay. ${s.testFiles} ward-scrolls remain and ${s.coveragePct}% of the lines hold. A curse is laid ` +
      `until the realm mends — its edict is law.${honoredCoda(j)}`,
    (s, j) =>
      `Somewhere below, scales slide over stone. The Oracle reads retreat in the entrails: the realm is ` +
      `weaker than when last you stood here (${s.coveragePct}% warded). Bear this curse and its edict ` +
      `until you earn redemption.${honoredCoda(j)}`,
  ],
  omen: [
    (s, j) =>
      `Smoke coils into shapes that refuse to settle. The Oracle reads neither triumph nor ruin in you — ` +
      `only a path not yet walked, ${s.coveragePct}% warded and ${s.testFiles} ward-scrolls strong. ` +
      `Heed the edict and return on the morrow.${honoredCoda(j)}`,
    (s, j) =>
      `The cave is quiet, the brazier steady. The auguries are balanced on a sword's edge: nothing won, ` +
      `nothing lost since the records began (${s.coveragePct}% of lines under ward). The Oracle offers an ` +
      `omen, and with it a habit worth keeping.${honoredCoda(j)}`,
    (s, j) =>
      `Stars wheel in the pool at the cave's heart, naming no victor. ${s.dragonsSlain} dragons lie slain ` +
      `and ${s.coveragePct}% of the realm is warded — a beginning, not a verdict. Take this omen's edict ` +
      `as your first law.${honoredCoda(j)}`,
  ],
};

/**
 * Edicts are agent style law and are inscribed into shared repo files, so
 * every one of them must read as a legitimate professional style directive a
 * teammate could follow without confusion. Curses mandate discipline;
 * blessings encourage good habits; omens set sensible baselines.
 */
const EDICT_POOL: Record<AuguryKind, Record<EdictFocus, string[]>> = {
  curse: {
    coveragePct: [
      'Strict TDD is in effect: write a failing test before any production change, and never merge a change that lowers total line coverage.',
      'Every bug fix must land with a regression test that fails without the fix; treat untested branches as broken until proven otherwise.',
      "Do not add new code paths to a file without also covering that file's existing untested lines; pay down coverage debt in every change you make.",
    ],
    testFiles: [
      'No module ships without a colocated test file; every source file you touch must gain at least one test naming the behavior it guards.',
      'Test-first only: create the test file before the implementation file, and keep a one-to-one mapping between modules and their tests.',
      'Before writing any new function, write the test that calls it; changes that add source files without test files are not acceptable.',
    ],
    dragonsSlain: [
      'Every mock must justify itself: add a comment explaining why the real implementation cannot be used, or test the real thing.',
      'Fix root causes, not symptoms: when a test exposes a defect, correct the implementation rather than loosening the assertion.',
      'A fix is not done until a test reproduces the original failure and passes against the corrected code; close defects fully or not at all.',
    ],
  },
  blessing: {
    coveragePct: [
      'Prefer table-driven tests named for the behavior they guard; one clear case per row beats one sprawling assertion.',
      'Keep the ground you have won: run the full test suite with every refactor, and add a characterization test before changing any untested code.',
      'Favor small, focused test cases with descriptive names; each test should document one behavior a reader could rely on.',
    ],
    testFiles: [
      'Keep tests fast and deterministic: inject clocks, randomness, and I/O as parameters so the suite never flakes.',
      'Group related cases in describe blocks named after the unit under test; a newcomer should be able to navigate the suite by names alone.',
      'Prefer pure functions and pass dependencies as parameters; a testable seam today spares a mock tomorrow.',
    ],
    dragonsSlain: [
      'When you fix a defect, pin it with a regression test named for the failure mode so it can never return unnoticed.',
      'Keep assertions specific: assert on the values that matter rather than broad snapshots, so failures point straight at the cause.',
      'Record each fixed bug in its test name and a brief comment; future maintainers should learn the history from the suite alone.',
    ],
  },
  omen: {
    coveragePct: [
      'Establish a baseline: run the coverage suite before and after each change, and never let the total drift downward.',
      'Begin as you mean to continue: every change set should leave line coverage equal to or higher than it found it.',
    ],
    testFiles: [
      'Each new module ships with a test file naming its core behaviors; start the habit before the codebase outgrows it.',
      'Write the first test for any file you touch that has none; one honest test beats a promise of many.',
    ],
    dragonsSlain: [
      'Track every known defect with a failing test before attempting a fix; the test defines what "fixed" means.',
      'When you find a bug, reproduce it in a test first; only then change the implementation.',
    ],
  },
};

// ── Small rites ──────────────────────────────────────────────────────────────

/** FNV-1a 32-bit — a humble, deterministic hash for seeding template picks. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
