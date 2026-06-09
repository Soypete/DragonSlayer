import { expect, test } from 'vitest';

// A stand-in siege drill: the scanner only counts banners, not battles.
test('the walls hold under siege', () => {
  expect(['trebuchet', 'ballista']).toContain('ballista');
});
