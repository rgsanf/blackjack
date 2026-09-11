import { LABEL_TO_RANK, RANK_VALUE } from "./cards";
import type { Card, HandValue, RankIndex } from "./types";

/**
 * Add one card to a running (total, isSoft) pair.
 *
 * This is the single most bug-prone function in any blackjack engine. Two traps:
 *
 *  1. A SECOND ace must count 1, not 11 — the first ace keeps the 11. Writing
 *     `isSoft || rank === ACE` instead of the branch below makes `A,2,A` report
 *     14 HARD when it is really 14 SOFT, which then mis-evaluates every hit.
 *  2. Demotion happens after the add, and only once, because at most one ace can
 *     ever be counted as 11 (two would be 22).
 */
export function addCard(
  total: number,
  isSoft: boolean,
  /** RankIndex, but typed as number: this is the hot inner loop and callers iterate 0..9. */
  rank: number,
): { total: number; isSoft: boolean } {
  let t: number;
  let s: boolean;
  if (rank === 0) {
    t = total + (isSoft ? 1 : 11);
    s = true;
  } else {
    t = total + RANK_VALUE[rank];
    s = isSoft;
  }
  if (t > 21 && s) {
    t -= 10;
    s = false;
  }
  return { total: t, isSoft: s };
}

/** Fold a list of rank buckets into a (total, isSoft) pair. */
export function totalOf(ranks: readonly RankIndex[]): { total: number; isSoft: boolean } {
  let total = 0;
  let isSoft = false;
  for (const r of ranks) {
    const next = addCard(total, isSoft, r);
    total = next.total;
    isSoft = next.isSoft;
  }
  return { total, isSoft };
}

export function evaluateHand(cards: readonly Card[]): HandValue {
  const ranks = cards.map((c) => c.rank);
  const { total, isSoft } = totalOf(ranks);
  const hardTotal = ranks.reduce<number>((sum, r) => sum + (r === 0 ? 1 : RANK_VALUE[r]), 0);
  const cardCount = cards.length;
  const isBust = total > 21;
  const isNatural = cardCount === 2 && total === 21;
  const isPair = cardCount === 2 && ranks[0] === ranks[1];
  return {
    cardCount,
    total,
    hardTotal,
    isSoft,
    isBust,
    isNatural,
    isPair,
    canHit: cardCount >= 1 && !isBust && !isNatural,
    canDouble: cardCount === 2 && !isNatural,
    canSplit: isPair && !isNatural,
  };
}

export function cardFromLabel(
  label: Card["label"],
  uid: number,
  suit: Card["suit"],
): Card {
  return { label, rank: LABEL_TO_RANK[label], uid, suit };
}
