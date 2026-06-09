/** The alchemy wing: brew restoratives for knights between battles. */

export type Reagent = 'emberroot' | 'moonwater' | 'wyrmscale' | 'nullshade';

export interface Potion {
  label: string;
  potency: number;
  volatile: boolean;
}

const REAGENT_POTENCY: Record<Reagent, number> = {
  emberroot: 12,
  moonwater: 7,
  wyrmscale: 25,
  nullshade: -10,
};

/** Combine reagents into a single draught. Order of reagents never matters. */
export function brewPotion(reagents: Reagent[]): Potion {
  if (reagents.length === 0) {
    throw new Error('An empty cauldron brews only disappointment.');
  }
  const potency = reagents.reduce((sum, r) => sum + REAGENT_POTENCY[r], 0);
  const volatile = reagents.includes('nullshade') && reagents.includes('emberroot');
  const label = potency >= 30 ? 'Greater Healing' : potency > 0 ? 'Lesser Healing' : 'Suspicious Sludge';
  return { label, potency: Math.max(0, potency), volatile };
}

/** Dilute a potion for trainees: halves potency, rounds down, defuses volatility. */
export function dilute(potion: Potion): Potion {
  return { label: `Diluted ${potion.label}`, potency: Math.floor(potion.potency / 2), volatile: false };
}
