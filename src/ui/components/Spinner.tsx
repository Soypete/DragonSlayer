/** A scrying glass that whirls while the realm waits on slow magic. */

import React, { useEffect, useState } from 'react';
import { Text } from 'ink';
import { COLORS } from '../theme.js';

const FRAMES = ['◐', '◓', '◑', '◒'];

export function Spinner({ label }: { label: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 120);
    return () => clearInterval(timer);
  }, []);

  return (
    <Text color={COLORS.arcana}>
      {FRAMES[frame]} {label}
    </Text>
  );
}
