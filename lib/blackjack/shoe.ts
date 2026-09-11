import { HI_LO, PER_DECK } from "./cards";
import type { Card, DeckMode, RankIndex } from "./types";

/** Counts per rank bucket. Infinite mode uses a single notional deck; probabilities come from INFINITE_P. */
export function buildShoe(deck: DeckMode): Int32Array {
  const decks = deck.kind === "infinite" ? 1 : deck.decks;
  const counts = new Int32Array(10);
  for (let r = 0; r < 10; r++) counts[r] = PER_DECK[r] * decks;
  return counts;
}

export function countRemaining(counts: Int32Array): number {
  let n = 0;
  for (let r = 0; r < 10; r++) n += counts[r];
  return n;
}

/** Mutates `counts`. Returns the first rank that went negative, if any. */
export function applyRemovals(
  counts: Int32Array,
  cards: readonly Card[],
): { ok: true } | { ok: false; rank: RankIndex } {
  for (const c of cards) counts[c.rank] -= 1;
  for (let r = 0; r < 10; r++) {
    if (counts[r] < 0) return { ok: false, rank: r as RankIndex };
  }
  return { ok: true };
}

/** Hi-Lo running count over every card seen. */
export function runningCount(cards: readonly Card[]): number {
  let rc = 0;
  for (const c of cards) rc += HI_LO[c.rank];
  return rc;
}
