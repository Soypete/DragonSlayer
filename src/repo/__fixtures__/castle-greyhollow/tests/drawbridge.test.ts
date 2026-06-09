import { describe, expect, it } from 'vitest';
import { lowerDrawbridge } from '../src/drawbridge.js';

describe('drawbridge (fixture garrison drill)', () => {
  it('welcomes friends across', () => {
    expect(lowerDrawbridge(true)).toContain('welcome');
  });

  it('repels strangers', () => {
    expect(lowerDrawbridge(false)).toBe('the bridge stays up');
  });
});
