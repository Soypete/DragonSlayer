/** The drawbridge: fully drilled, fully covered. No dragon lairs here. */
export function lowerDrawbridge(isFriend: boolean): string {
  return isFriend ? 'creeeak — welcome, traveler' : 'the bridge stays up';
}
