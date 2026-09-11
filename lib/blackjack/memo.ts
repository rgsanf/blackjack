import { INFINITE_P } from "./cards";
import type { RankIndex } from "./types";

/**
 * Per-rank maximum number of cards that can be removed DURING recursion, used to pack
 * the removed-card multiset into a single float64 memo key.
 *
 * Why a mixed radix rather than the obvious 5-bits-per-rank: a hand's hard total rises
 * by at least 1 per card and caps at 21, so up to 21 aces can be drawn to one hand and
 * 42 across two. A 5-bit field saturates at 31 and would silently alias 32 removed aces
 * into the twos field — a real collision at 8 decks, not a theoretical one.
 */
export const RADIX = [40, 24, 16, 12, 10, 9, 8, 7, 6, 6] as const;

/** Cumulative place values. Product is ~3.3e10, comfortably inside 2^53. */
export const MULT: readonly number[] = (() => {
  const m: number[] = [];
  for (let i = 0; i < RADIX.length; i++) m.push(i === 0 ? 1 : m[i - 1] * RADIX[i - 1]);
  return m;
})();

export interface EngineContext {
  counts: Int32Array;
  remaining: number;
  infinite: boolean;
  decks: number | null;
  /** Packed multiset of cards removed since the root state. Memo key component. */
  removedCode: number;
  /** Cards drawn by the player since the root, per rank. Drives the first-order correction. */
  drawn: Int32Array;
  dealerRanks: RankIndex[];
  precision: "fast" | "exact";
  /** (total << 1) | soft  ->  removedCode -> distribution over [17,18,19,20,21,bust] */
  dealerMemo: Map<number, Float64Array>[];
  /** (total << 1) | soft  ->  removedCode -> [ev, win, push, loss] */
  hitMemo: Map<number, Float64Array>[];
  base: Float64Array | null;
  delta: (Float64Array | null)[];
  /**
   * Rank the hole card must NOT be for the dealer to lack a natural:
   * TEN when the upcard is an ace, ACE when the upcard is a ten, else null.
   */
  peekRank: RankIndex | null;
  exhausted: boolean;
  dealerNodes: number;
  playerNodes: number;
}

/**
 * The ONLY place card removal is bookkept. Keeping counts, remaining, removedCode and
 * drawn in one push/pop pair is what stops them drifting apart — historically the second
 * most common bug in engines of this shape after soft-ace handling.
 *
 * Mutate-and-restore on one shared array, never copy: an exact analysis visits ~1e5 nodes,
 * and a fresh Int32Array per node would allocate ~190k arrays.
 */
export function pushCard(ctx: EngineContext, r: number): void {
  if (!ctx.infinite) {
    ctx.counts[r] -= 1;
    ctx.remaining -= 1;
  }
  ctx.removedCode += MULT[r];
  ctx.drawn[r] += 1;
}

export function popCard(ctx: EngineContext, r: number): void {
  if (!ctx.infinite) {
    ctx.counts[r] += 1;
    ctx.remaining += 1;
  }
  ctx.removedCode -= MULT[r];
  ctx.drawn[r] -= 1;
}

/** Exact draw probability. With replacement in infinite mode. */
export function drawP(ctx: EngineContext, r: number): number {
  if (ctx.infinite) return INFINITE_P[r];
  return ctx.remaining > 0 ? ctx.counts[r] / ctx.remaining : 0;
}

/**
 * In infinite mode the shoe never changes, so the memo key collapses to (total, soft)
 * alone — 202 reachable dealer states in total.
 */
export function memoKey(ctx: EngineContext): number {
  return ctx.infinite ? 0 : ctx.removedCode;
}
