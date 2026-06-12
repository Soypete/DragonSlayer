/**
 * metrics.ts — the Assayer's Scales.
 *
 * Every coverage dialect ultimately weighs the same three numbers: how much
 * ground there is, how much is proven, and what fraction that makes. These
 * scales keep every interpreter honest about the arithmetic.
 */

import type { CoverageMetric } from '../../types.js';

export function asFiniteNumber(value: unknown): number {
  // Istanbul writes "Unknown" for empty totals; treat anything unholy as 0.
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Read a metric an istanbul-shaped document already computed. */
export function readMetric(raw: unknown): CoverageMetric {
  const m = (raw ?? {}) as Record<string, unknown>;
  return {
    total: asFiniteNumber(m.total),
    covered: asFiniteNumber(m.covered),
    pct: asFiniteNumber(m.pct),
  };
}

/**
 * Weigh a metric from raw counts. A file with nothing to cover counts as
 * fully proven (pct 100) — empty ground must not host immortal dragons,
 * since HP is derived from `total - covered`.
 */
export function makeMetric(total: number, covered: number): CoverageMetric {
  const pct = total > 0 ? Number(((covered / total) * 100).toFixed(2)) : 100;
  return { total, covered, pct };
}

/** The unweighed metric: a dialect that simply cannot speak of this measure. */
export function emptyMetric(): CoverageMetric {
  return { total: 0, covered: 0, pct: 0 };
}
