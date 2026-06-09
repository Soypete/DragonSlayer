import { describe, expect, it } from 'vitest';
import {
  hpBar,
  hpColor,
  speciesSigil,
  questSigil,
  questColor,
  formatPct,
  formatDuration,
  COLORS,
} from './theme.js';

describe('hpBar — the wound-gauge smithy', () => {
  it('shows a full bar at full health', () => {
    expect(hpBar(10, 10, 10)).toBe('██████████');
  });

  it('shows an empty bar for a slain dragon', () => {
    expect(hpBar(0, 10, 10)).toBe('░░░░░░░░░░');
  });

  it('always grants a living dragon at least one scale', () => {
    expect(hpBar(1, 1000, 10)).toBe('█░░░░░░░░░');
  });

  it('renders half health as half scales', () => {
    expect(hpBar(5, 10, 10)).toBe('█████░░░░░');
  });

  it('clamps overheal and negative hp', () => {
    expect(hpBar(99, 10, 4)).toBe('████');
    expect(hpBar(-5, 10, 4)).toBe('░░░░');
  });

  it('survives a zero-hp dragon without dividing the realm by zero', () => {
    expect(hpBar(0, 0, 4)).toBe('░░░░');
  });
});

describe('hpColor — the dragon threat-gauge', () => {
  it('burns ember-red at full fury', () => {
    expect(hpColor(10, 10)).toBe(COLORS.ember);
    expect(hpColor(9, 10)).toBe(COLORS.ember);
  });
  it('burns torch-orange when bloodied', () => {
    expect(hpColor(5, 10)).toBe(COLORS.torch);
    expect(hpColor(7, 10)).toBe(COLORS.torch);
  });
  it('dims to gold as the beast falters', () => {
    expect(hpColor(3, 10)).toBe(COLORS.gold);
    expect(hpColor(2, 10)).toBe(COLORS.gold);
  });
  it('grants a verdant sliver only when nearly slain', () => {
    expect(hpColor(1, 10)).toBe(COLORS.verdant);
    expect(hpColor(15, 100)).toBe(COLORS.verdant);
  });
  it('fades to parchment when slain', () => {
    expect(hpColor(0, 10)).toBe(COLORS.parchment);
    expect(hpColor(-3, 10)).toBe(COLORS.parchment);
    expect(hpColor(0, 0)).toBe(COLORS.parchment);
  });
});

describe('sigils', () => {
  it('marks every species with a glyph', () => {
    for (const species of [
      'Syntax Wyrm',
      'Null Drake',
      'Race Wyvern',
      'Flaky Hydra',
      'Off-by-One Imp',
      'Regression Behemoth',
      'Legacy Lindworm',
    ] as const) {
      expect(speciesSigil(species)).toBeTruthy();
    }
  });

  it('marks quest standing', () => {
    expect(questSigil('complete')).toBe('✓');
    expect(questSigil('active')).toBe('◆');
    expect(questSigil('available')).toBe('◇');
    expect(questColor('complete')).toBe(COLORS.verdant);
  });
});

describe('numerals of the realm', () => {
  it('formats whole percentages without decimals', () => {
    expect(formatPct(100)).toBe('100%');
    expect(formatPct(0)).toBe('0%');
  });
  it('keeps one decimal otherwise', () => {
    expect(formatPct(47.56)).toBe('47.6%');
  });
  it('formats durations for the bards', () => {
    expect(formatDuration(42_000)).toBe('42s');
    expect(formatDuration(83_000)).toBe('1m 23s');
    expect(formatDuration(-5)).toBe('0s');
  });
});
