/**
 * The Royal Tapestry — colors, sigils, and bar-smithing for the realm's UI.
 * Pure helpers only; no clocks, no dice, no DOM. Ink components consume these.
 */

import type { AuguryKind, DragonSpecies, QuestStatus } from '../types.js';

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

/**
 * The color a dragon's wound-gauge burns at. Dragons are DANGER, so the gauge
 * reads like a threat meter: ember-red at full strength, torch-orange once
 * bloodied, gold as the beast falters, and a verdant sliver only when it is
 * nearly slain. (Every current caller renders dragon HP; if a friendly
 * progress bar ever needs the old green-when-full ramp, give it its own
 * helper rather than reusing this one.)
 */
export function hpColor(hp: number, maxHp: number): string {
  const ratio = maxHp > 0 ? hp / maxHp : 0;
  if (hp <= 0 || ratio <= 0) return COLORS.parchment;
  if (ratio <= 0.15) return COLORS.verdant; // nearly slain — one green sliver of hope
  if (ratio < 0.45) return COLORS.gold; // faltering
  if (ratio < 0.8) return COLORS.torch; // bloodied but fighting
  return COLORS.ember; // full fury
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

/** The banner pinned beside every pledged quest on the guild board. */
export const PLEDGE_SIGIL = '⚑';

const AUGURY_SIGILS: Record<AuguryKind, string> = {
  blessing: '☀',
  curse: '☠',
  omen: '☽',
};

/** A single glyph for the day's augury — sun, skull, or crescent. */
export function augurySigil(kind: AuguryKind): string {
  return AUGURY_SIGILS[kind];
}

/** The light an augury burns by: verdant blessing, ember curse, arcane omen. */
export function auguryColor(kind: AuguryKind): string {
  if (kind === 'blessing') return COLORS.verdant;
  if (kind === 'curse') return COLORS.ember;
  return COLORS.arcana;
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
