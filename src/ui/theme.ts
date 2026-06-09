/**
 * The Royal Tapestry — colors, sigils, and bar-smithing for the realm's UI.
 * Pure helpers only; no clocks, no dice, no DOM. Ink components consume these.
 */

import type { DragonSpecies, QuestStatus } from '../types.js';

// ── Court colors (chalk-compatible names / hex for Ink <Text color=…>) ──────

export const COLORS = {
  /** Royal gold — treasure, titles, the crown. */
  gold: '#ffd700',
  /** Dragonfire — danger, mistakes, dragons at full strength. */
  ember: '#ff6347',
  /** Forest of the Green Suite — covered lines, clean strikes. */
  verdant: '#3cb371',
  /** Torchlight — warnings, half-slain dragons. */
  torch: '#ffa500',
  /** Moonlit steel — chrome, borders, secondary text. */
  steel: '#87a0b8',
  /** Faded parchment — hints, dimmed prose. */
  parchment: 'gray',
  /** Oracle violet — prophecy and arcana. */
  arcana: '#b07cff',
  /** Banner blue — selections and highlights. */
  banner: '#4dc3ff',
} as const;

// ── HP bars ──────────────────────────────────────────────────────────────────

const SCALE_FULL = '█';
const SCALE_EMPTY = '░';

/**
 * Forge an HP bar of `width` cells: filled scales for remaining hp,
 * hollow scales for wounds. A living dragon (hp > 0) always shows
 * at least one scale; a slain one shows none.
 */
export function hpBar(hp: number, maxHp: number, width = 16): string {
  const span = Math.max(1, width);
  const max = Math.max(1, maxHp);
  const ratio = Math.min(1, Math.max(0, hp / max));
  let filled = Math.round(ratio * span);
  if (hp > 0 && filled === 0) filled = 1;
  if (hp <= 0) filled = 0;
  return SCALE_FULL.repeat(filled) + SCALE_EMPTY.repeat(span - filled);
}

/** The color a wound-gauge burns at: green when hale, orange when bloodied, red when desperate. */
export function hpColor(hp: number, maxHp: number): string {
  const ratio = maxHp > 0 ? hp / maxHp : 0;
  if (ratio <= 0) return COLORS.parchment;
  if (ratio < 1 / 3) return COLORS.ember;
  if (ratio < 2 / 3) return COLORS.torch;
  return COLORS.verdant;
}

// ── Sigils ───────────────────────────────────────────────────────────────────

const SPECIES_SIGILS: Record<DragonSpecies, string> = {
  'Syntax Wyrm': '§',
  'Null Drake': 'ø',
  'Race Wyvern': '⚡',
  'Flaky Hydra': '〜',
  'Off-by-One Imp': '±',
  'Regression Behemoth': '▲',
  'Legacy Lindworm': '꩜',
};

/** A single glyph marking each dragon species on the realm map. */
export function speciesSigil(species: DragonSpecies): string {
  return SPECIES_SIGILS[species] ?? '?';
}

const QUEST_SIGILS: Record<QuestStatus, string> = {
  available: '◇',
  active: '◆',
  complete: '✓',
};

/** Glyph for a quest's standing on the guild board. */
export function questSigil(status: QuestStatus): string {
  return QUEST_SIGILS[status];
}

export function questColor(status: QuestStatus): string {
  if (status === 'complete') return COLORS.verdant;
  if (status === 'active') return COLORS.banner;
  return COLORS.steel;
}

// ── Numerals of the realm ────────────────────────────────────────────────────

/** "47.6%" — coverage percentage, one decimal unless whole. */
export function formatPct(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

/** "1m 23s" / "42s" — battle durations for the bards. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

/** The banner hoisted over the whole campaign. */
export const BANNER = [
  '╔═╗ ╦═╗ ╔═╗ ╔═╗ ╔═╗ ╔╗╔ ╔═╗ ╦   ╔═╗ ╦ ╦ ╔═╗ ╦═╗',
  '║ ║ ╠╦╝ ╠═╣ ║ ╦ ║ ║ ║║║ ╚═╗ ║   ╠═╣ ╚╦╝ ║╣  ╠╦╝',
  '╚═╝ ╩╚═ ╩ ╩ ╚═╝ ╚═╝ ╝╚╝ ╚═╝ ╩═╝ ╩ ╩  ╩  ╚═╝ ╩╚═',
] as const;
