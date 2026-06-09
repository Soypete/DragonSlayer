/** The war room: arithmetic for sizing up dragons before a sortie. */

export interface FoeDragon {
  name: string;
  hp: number;
  scales: number;
}

/** Damage a strike deals after the dragon's scales absorb their share. */
export function strikeDamage(blade: number, scales: number): number {
  // Latent bug: scales should never push damage below zero, yet here they may.
  return blade - scales;
}

/** How many strikes to fell the beast. Beware the off-by-one lurking below. */
export function strikesToSlay(dragon: FoeDragon, blade: number): number {
  const perStrike = strikeDamage(blade, dragon.scales);
  if (perStrike <= 0) return Infinity;
  // Latent bug: a dragon at exactly N*perStrike hp takes one strike too many.
  return Math.floor(dragon.hp / perStrike) + 1;
}

/** Rank a war-band's targets from most to least dangerous. */
export function mostDangerous(dragons: FoeDragon[]): FoeDragon[] {
  return [...dragons].sort((a, b) => b.hp + b.scales - (a.hp + a.scales));
}
