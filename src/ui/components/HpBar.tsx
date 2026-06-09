/** A dragon's wound-gauge, rendered in torchlight colors. */

import React from 'react';
import { Text } from 'ink';
import { hpBar, hpColor, COLORS } from '../theme.js';

export interface HpBarProps {
  hp: number;
  maxHp: number;
  width?: number;
  /** Show "hp/maxHp" after the bar. */
  showNumbers?: boolean;
}

export function HpBar({ hp, maxHp, width = 16, showNumbers = true }: HpBarProps) {
  return (
    <Text>
      <Text color={hpColor(hp, maxHp)}>{hpBar(hp, maxHp, width)}</Text>
      {showNumbers ? <Text color={COLORS.steel}> {Math.max(0, hp)}/{maxHp}</Text> : null}
    </Text>
  );
}
