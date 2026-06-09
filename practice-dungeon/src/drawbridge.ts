/** The gatehouse: a small state machine governing the castle drawbridge. */

export type BridgeState = 'raised' | 'lowering' | 'lowered' | 'raising';
export type BridgeCommand = 'lower' | 'raise' | 'tick';

const TRANSITIONS: Record<BridgeState, Partial<Record<BridgeCommand, BridgeState>>> = {
  raised: { lower: 'lowering' },
  lowering: { tick: 'lowered', raise: 'raising' },
  lowered: { raise: 'raising' },
  raising: { tick: 'raised', lower: 'lowering' },
};

/** Apply a command to the bridge; unknown moves leave the bridge unmoved. */
export function commandBridge(state: BridgeState, command: BridgeCommand): BridgeState {
  return TRANSITIONS[state][command] ?? state;
}

/** May a cart cross? Only when the bridge rests fully lowered. */
export function canCross(state: BridgeState): boolean {
  return state === 'lowered';
}

/** Run a sequence of commands from a starting state and report the journey. */
export function runGatehouse(start: BridgeState, commands: BridgeCommand[]): BridgeState[] {
  const journey: BridgeState[] = [start];
  let current = start;
  for (const command of commands) {
    current = commandBridge(current, command);
    journey.push(current);
  }
  return journey;
}
