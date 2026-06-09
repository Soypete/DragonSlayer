import { describe, expect, it } from 'vitest';
import { brewPotion, dilute } from '../src/potions.js';

describe('the alchemy wing', () => {
  it('brews Greater Healing from strong reagents', () => {
    const potion = brewPotion(['wyrmscale', 'emberroot']);
    expect(potion).toEqual({ label: 'Greater Healing', potency: 37, volatile: false });
  });

  it('brews Lesser Healing from humble reagents', () => {
    expect(brewPotion(['moonwater'])).toEqual({ label: 'Lesser Healing', potency: 7, volatile: false });
  });

  it('clamps Suspicious Sludge at zero potency', () => {
    const sludge = brewPotion(['nullshade', 'nullshade']);
    expect(sludge.label).toBe('Suspicious Sludge');
    expect(sludge.potency).toBe(0);
  });

  it('marks emberroot + nullshade as volatile', () => {
    expect(brewPotion(['emberroot', 'nullshade']).volatile).toBe(true);
  });

  it('refuses an empty cauldron', () => {
    expect(() => brewPotion([])).toThrow(/empty cauldron/);
  });

  it('dilutes a potion for trainees, defusing volatility', () => {
    const diluted = dilute({ label: 'Greater Healing', potency: 37, volatile: true });
    expect(diluted).toEqual({ label: 'Diluted Greater Healing', potency: 18, volatile: false });
  });
});
