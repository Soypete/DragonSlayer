/** The scriptorium: a ledger of quests sworn, abandoned, and fulfilled. */

export interface LedgerEntry {
  id: string;
  title: string;
  bounty: number;
  fulfilled: boolean;
}

/** Swear a new quest into the ledger. Duplicate ids are an oathbreaker's error. */
export function swearQuest(ledger: LedgerEntry[], id: string, title: string, bounty: number): LedgerEntry[] {
  if (ledger.some((entry) => entry.id === id)) {
    throw new Error(`Quest "${id}" is already sworn in this ledger.`);
  }
  return [...ledger, { id, title, bounty, fulfilled: false }];
}

/** Mark a quest fulfilled. Unknown quests are quietly ignored (a latent bug?). */
export function fulfillQuest(ledger: LedgerEntry[], id: string): LedgerEntry[] {
  return ledger.map((entry) => (entry.id === id ? { ...entry, fulfilled: true } : entry));
}

/** Total gold owed for fulfilled quests. */
export function tallyBounty(ledger: LedgerEntry[]): number {
  return ledger.filter((entry) => entry.fulfilled).reduce((sum, entry) => sum + entry.bounty, 0);
}

/** Quests still open, sorted by richest bounty first. */
export function openQuests(ledger: LedgerEntry[]): LedgerEntry[] {
  return ledger.filter((entry) => !entry.fulfilled).sort((a, b) => b.bounty - a.bounty);
}
