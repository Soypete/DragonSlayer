/** The portcullis: never once tested. The most dangerous dragon in the keep. */
export type GateState = 'raised' | 'lowered' | 'jammed';

export function dropPortcullis(state: GateState): GateState {
  if (state === 'jammed') {
    return 'jammed';
  }
  return 'lowered';
}

export function raisePortcullis(state: GateState): GateState {
  return state === 'jammed' ? 'jammed' : 'raised';
}
