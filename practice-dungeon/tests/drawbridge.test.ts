import { describe, expect, it } from 'vitest';
import { canCross, commandBridge, runGatehouse } from '../src/drawbridge.js';

describe('the gatehouse', () => {
  it('lowers the raised bridge on command', () => {
    expect(commandBridge('raised', 'lower')).toBe('lowering');
    expect(commandBridge('lowering', 'tick')).toBe('lowered');
  });

  it('raises the lowered bridge on command', () => {
    expect(commandBridge('lowered', 'raise')).toBe('raising');
    expect(commandBridge('raising', 'tick')).toBe('raised');
  });

  it('reverses mid-motion when the watch panics', () => {
    expect(commandBridge('lowering', 'raise')).toBe('raising');
    expect(commandBridge('raising', 'lower')).toBe('lowering');
  });

  it('ignores commands that make no sense', () => {
    expect(commandBridge('raised', 'raise')).toBe('raised');
    expect(commandBridge('lowered', 'tick')).toBe('lowered');
  });

  it('lets carts cross only when fully lowered', () => {
    expect(canCross('lowered')).toBe(true);
    expect(canCross('lowering')).toBe(false);
    expect(canCross('raised')).toBe(false);
  });

  it('chronicles a full journey through the gatehouse', () => {
    expect(runGatehouse('raised', ['lower', 'tick', 'raise', 'tick'])).toEqual([
      'raised',
      'lowering',
      'lowered',
      'raising',
      'raised',
    ]);
  });
});
