/** The moat: partially proven. A middling dragon paddles in the shallows. */
export function moatDepth(rainfall: number, drainage: number): number {
  return Math.max(0, rainfall - drainage);
}

export function isCrocodileInfested(depth: number): boolean {
  return depth > 3;
}
