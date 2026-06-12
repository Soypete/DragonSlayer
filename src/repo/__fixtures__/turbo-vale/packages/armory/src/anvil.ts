/** The anvil — barely struck by any hammer of proof. */
export function strikeAnvil(blows: number): number {
  let sparks = 0;
  for (let i = 0; i < blows; i++) {
    sparks += i % 3 === 0 ? 2 : 1;
  }
  return sparks;
}
