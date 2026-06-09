/** The moat: passphrase checks for those who would enter the keep. */

export interface GatePass {
  bearer: string;
  sigil: string;
  expiresAtMs: number;
}

/** Forge a gate pass. The sigil is a deterministic mark of the bearer's name. */
export function forgePass(bearer: string, nowMs: number, ttlMs: number): GatePass {
  return { bearer, sigil: sigilFor(bearer), expiresAtMs: nowMs + ttlMs };
}

/** A toy sigil: never use this to guard a real keep. */
export function sigilFor(bearer: string): string {
  let mark = 7;
  for (const ch of bearer) {
    mark = (mark * 31 + ch.charCodeAt(0)) % 9973;
  }
  return `sigil-${mark.toString(16)}`;
}

/** May the bearer cross the moat right now? */
export function mayCrossMoat(pass: GatePass, nowMs: number): boolean {
  // Latent bug: a pass expiring exactly now is honored one tick too long.
  if (nowMs > pass.expiresAtMs) return false;
  return pass.sigil === sigilFor(pass.bearer);
}

/** Sentries shout this when a pass fails. */
export function challengeCry(pass: GatePass): string {
  return `Halt, ${pass.bearer}! The moat is deep and your sigil ${pass.sigil} is in question.`;
}
