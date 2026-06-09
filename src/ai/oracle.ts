/// <reference types="node" />
/**
 * The Oracle of the Coverage Caves.
 *
 * Knights may climb the mountain and ask the great seer (the `claude` CLI,
 * summoned via `claude -p ... --output-format json`) which dragons threaten
 * the realm most. The oracle is moody: if she is absent (binary missing),
 * slow (timeout), or speaks in riddles we cannot parse (bad JSON), we fall
 * back — silently, as is tradition — to the village elder's heuristic,
 * `fallbackProphecy`, which simply points at the biggest dragons.
 */

import { execFile } from 'node:child_process';
import type { Dragon, OracleProphecy, RepoScan } from '../types.js';

/** How many doomed files the oracle is asked (or the elder deigns) to name. */
const HOTSPOT_LIMIT = 5;

/** How many dragons we describe to the oracle before her patience wanes. */
const TRIBUTE_LIMIT = 8;

/** Cap on the oracle's breath (stdout), lest she flood the throne room. */
const MAX_ORACLE_BREATH_BYTES = 1024 * 1024;

/** The shape a true prophecy must take, before we stamp a `source` on it. */
type ProphecyOmen = Pick<OracleProphecy, 'hotspots' | 'proclamation'>;

// ── Consulting the seer ──────────────────────────────────────────────────────

/**
 * Climb the mountain and consult the oracle about the scariest dragons.
 * Never throws: every misfortune on the path collapses into the elder's
 * fallback prophecy.
 */
export async function consultOracle(
  scan: RepoScan,
  dragons: Dragon[],
  timeoutMs = 30000,
): Promise<OracleProphecy> {
  try {
    const utterance = await summonClaude(composePlea(scan, dragons), timeoutMs);
    const envelope = JSON.parse(utterance) as { result?: unknown };
    if (typeof envelope.result !== 'string') return fallbackProphecy(scan, dragons);
    const omen = extractProphecyJson(envelope.result);
    if (omen === null) return fallbackProphecy(scan, dragons);
    return { ...omen, source: 'claude' };
  } catch {
    // The seer was absent, tardy, or incomprehensible. The elder shrugs.
    return fallbackProphecy(scan, dragons);
  }
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

/** Compose the plea laid at the oracle's feet, naming the top uncovered files. */
function composePlea(scan: RepoScan, dragons: Dragon[]): string {
  const tribute = rankDragonsByMenace(dragons)
    .slice(0, TRIBUTE_LIMIT)
    .map(
      (d) =>
        `- ${d.file}: ${d.hp} uncovered lines, ${d.coveragePct}% line coverage (${d.species} "${d.name}")`,
    )
    .join('\n');
  const wards = scan.testFiles.length;
  return [
    'You are the Oracle in a fantasy RPG about code reliability. Bugs are dragons;',
    'untested files are their lairs. Given the most under-covered files in the',
    `repo at ${scan.repoPath} (which has ${wards} test files), pick the` ,
    `${HOTSPOT_LIMIT} most dangerous files to test next and why.`,
    '',
    'The lairs:',
    tribute || '- (no dragons sighted; praise the realm)',
    '',
    'Respond with ONLY a JSON object, no prose, of the shape:',
    '{"hotspots":[{"file":"<path>","reason":"<one short sentence>"}],"proclamation":"<one dramatic sentence of oracle flavor>"}',
  ].join('\n');
}

// ── Reading the entrails (JSON extraction) ───────────────────────────────────

/**
 * Pull a prophecy out of the oracle's raw utterance. Tolerates fenced code
 * blocks (```json ... ```) and stray prose around the braces. Returns null
 * when no well-formed prophecy can be divined.
 */
export function extractProphecyJson(utterance: string): ProphecyOmen | null {
  for (const rune of candidateRunes(utterance)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rune);
    } catch {
      continue;
    }
    const omen = sanctifyOmen(parsed);
    if (omen !== null) return omen;
  }
  return null;
}

/** Candidate JSON texts hidden in the utterance, most-likely first. */
function* candidateRunes(utterance: string): Generator<string> {
  const trimmed = utterance.trim();
  if (trimmed.length === 0) return;
  yield trimmed;

  // Fenced code blocks, e.g. ```json\n{...}\n```
  const fences = trimmed.matchAll(/```(?:json)?\s*\n?([\s\S]*?)```/gi);
  for (const fence of fences) {
    const body = fence[1].trim();
    if (body.length > 0) yield body;
  }

  // Last resort: the outermost brace-bound slab.
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last > first) yield trimmed.slice(first, last + 1);
}

/** Validate an arbitrary parsed value into a true omen, or reject it (null). */
function sanctifyOmen(parsed: unknown): ProphecyOmen | null {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const { hotspots, proclamation } = parsed as Record<string, unknown>;
  if (typeof proclamation !== 'string' || proclamation.trim().length === 0) return null;
  if (!Array.isArray(hotspots)) return null;
  const blessed: ProphecyOmen['hotspots'] = [];
  for (const spot of hotspots) {
    if (typeof spot !== 'object' || spot === null) return null;
    const { file, reason } = spot as Record<string, unknown>;
    if (typeof file !== 'string' || typeof reason !== 'string') return null;
    blessed.push({ file, reason });
  }
  return { hotspots: blessed.slice(0, HOTSPOT_LIMIT), proclamation: proclamation.trim() };
}

// ── The village elder's heuristic ────────────────────────────────────────────

/**
 * The elder's prophecy: no magic, just arithmetic. Living dragons ranked by
 * hit points (uncovered lines) descending; ties broken by path so the omen
 * never wavers between tellings. Deterministic, source 'fallback'.
 */
export function fallbackProphecy(scan: RepoScan, dragons: Dragon[]): OracleProphecy {
  const menaces = rankDragonsByMenace(dragons).slice(0, HOTSPOT_LIMIT);
  const hotspots = menaces.map((dragon) => ({
    file: dragon.file,
    reason: elderReason(dragon, scan),
  }));
  return {
    hotspots,
    proclamation: elderProclamation(menaces),
    source: 'fallback',
  };
}

/** Living dragons, most uncovered lines first; ties broken by file path. */
function rankDragonsByMenace(dragons: Dragon[]): Dragon[] {
  return dragons
    .filter((dragon) => !dragon.slain && dragon.hp > 0)
    .sort((a, b) => b.hp - a.hp || a.file.localeCompare(b.file));
}

/** Why the elder fears this particular lair. */
function elderReason(dragon: Dragon, scan: RepoScan): string {
  const lines = `${dragon.hp} uncovered line${dragon.hp === 1 ? '' : 's'}`;
  if (!isNamedByAnyWard(dragon.file, scan.testFiles)) {
    return `${lines} and no test file names it — the ${dragon.species} sleeps unchallenged`;
  }
  if (dragon.coveragePct <= 0) {
    return `${lines} and not one of them warded — a ward exists but never strikes`;
  }
  return `${lines}; its wards cover a mere ${dragon.coveragePct}% of the lair`;
}

/** Crude but honest: does any test file's name invoke this file's basename? */
function isNamedByAnyWard(file: string, testFiles: string[]): boolean {
  const basename = file.split('/').pop() ?? file;
  const stem = basename.replace(/\.[^.]+$/, '');
  if (stem.length === 0) return false;
  return testFiles.some((ward) => {
    const wardName = ward.split('/').pop() ?? ward;
    return wardName.includes(stem);
  });
}

/** The elder's closing words, sized to the threat. */
function elderProclamation(menaces: Dragon[]): string {
  if (menaces.length === 0) {
    return 'The elder squints at the horizon and finds it empty of wings. The realm rests — for now.';
  }
  const [greatest] = menaces;
  return (
    `The oracle is silent, so the elder speaks: ${greatest.name} the ${greatest.species} ` +
    `coils atop ${greatest.file} with ${greatest.hp} untested lines. Strike there first, knight.`
  );
}
