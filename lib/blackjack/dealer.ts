import { ACE, TEN } from "./cards";
import { addCard, totalOf } from "./hand";
import { drawP, memoKey, popCard, pushCard, type EngineContext } from "./memo";
import type { RankIndex } from "./types";

/** Distribution index: 0..4 = final total 17..21, 5 = bust. */
export const BUST_IDX = 5;

function pointMass(idx: number): Float64Array {
  const out = new Float64Array(6);
  out[idx] = 1;
  return out;
}

/**
 * Distribution of the dealer's final total from a known running (total, isSoft).
 *
 * S17: the dealer stands on every 17, soft 17 included. Getting this wrong is the
 * single easiest way to silently produce an H17 engine — the tell is upcard 6, whose
 * 17-row should be ~16.5% under S17 and ~11.5% under H17.
 *
 * Termination needs no depth limit: the hard total rises by at least 1 per card and
 * caps at 21, so at most 21 cards can be drawn.
 */
export function dealerFrom(
  ctx: EngineContext,
  total: number,
  isSoft: boolean,
): Float64Array {
  if (total > 21) return pointMass(BUST_IDX);
  if (total >= 17) return pointMass(total - 17);

  if (!ctx.infinite && ctx.remaining <= 0) {
    // Pathological: the shoe ran dry mid-draw, so the round cannot actually be
    // completed. Flagged to the caller; treated as standing so nothing returns NaN.
    ctx.exhausted = true;
    return pointMass(0);
  }

  const bucket = (total << 1) | (isSoft ? 1 : 0);
  const key = memoKey(ctx);
  const table = ctx.dealerMemo[bucket];
  const cached = table.get(key);
  if (cached) return cached;

  const out = new Float64Array(6);
  for (let r = 0; r < 10; r++) {
    const p = drawP(ctx, r);
    if (p <= 0) continue;
    pushCard(ctx, r);
    const next = addCard(total, isSoft, r);
    const sub = dealerFrom(ctx, next.total, next.isSoft);
    for (let i = 0; i < 6; i++) out[i] += p * sub[i];
    popCard(ctx, r);
  }

  ctx.dealerNodes += 1;
  table.set(key, out);
  return out;
}

/**
 * Accumulate the dealer's final-total mass for one known first card, weighted by
 * `weight` and added into `out`. Returns the weighted natural mass it split off.
 *
 * Naturals are split off rather than folded in so the CALLER renormalises on
 * "no natural" once, after summing over every first card it cares about. Doing it
 * per upcard instead would renormalise each row separately and then average rows
 * that are conditioned on different events - subtly wrong for the no-card prior.
 *
 * The caller owns `up`'s removal from the shoe; this function only removes the hole
 * card, and always restores it.
 */
function accumulateFromUpcard(
  ctx: EngineContext,
  up: RankIndex,
  weight: number,
  out: Float64Array,
): number {
  const start = addCard(0, false, up);
  let pNatural = 0;

  for (let h = 0; h < 10; h++) {
    const p = drawP(ctx, h);
    if (p <= 0) continue;
    if ((up === ACE && h === TEN) || (up === TEN && h === ACE)) {
      pNatural += weight * p;
      continue;
    }
    pushCard(ctx, h);
    const next = addCard(start.total, start.isSoft, h);
    const sub = dealerFrom(ctx, next.total, next.isSoft);
    for (let i = 0; i < 6; i++) out[i] += weight * p * sub[i];
    popCard(ctx, h);
  }

  return pNatural;
}

/** Rescale to a proper distribution conditioned on the dealer not having a natural. */
function renormaliseOnNoNatural(out: Float64Array, pNatural: number): void {
  if (pNatural <= 0 || pNatural >= 1) return;
  const inv = 1 / (1 - pNatural);
  for (let i = 0; i < 6; i++) out[i] *= inv;
}

/**
 * Exact dealer distribution for the current shoe, peek-conditioned.
 *
 * Three cases, all reachable because the user may edit the dealer's hand freely:
 *  - no cards: the prior. Enumerate both the upcard and the hole card, so the answer
 *    is the distribution of the dealer's final total before the deal - what you are
 *    up against on average at this shoe composition.
 *  - one known card: enumerate the hole card, splitting off naturals and renormalising
 *    on "no natural". The hole card is removed BEFORE the dealer's next draw, which is
 *    what makes card-removal effects real rather than cosmetic.
 *  - two or more known cards: recurse from the known total. pNatural is 0 and there is
 *    nothing to renormalise, because the hand either is a natural (resolved upstream)
 *    or provably is not.
 */
export function dealerDistExact(ctx: EngineContext): {
  dist: Float64Array;
  pNatural: number;
} {
  const dr = ctx.dealerRanks;

  if (dr.length === 0) {
    const out = new Float64Array(6);
    let pNatural = 0;

    for (let u = 0; u < 10; u++) {
      const pUp = drawP(ctx, u);
      if (pUp <= 0) continue;
      // Removed before the hole card is enumerated: at one deck, an upcard of 10 must
      // leave 15 tens for the hole card, not 16.
      pushCard(ctx, u);
      pNatural += accumulateFromUpcard(ctx, u as RankIndex, pUp, out);
      popCard(ctx, u);
    }

    renormaliseOnNoNatural(out, pNatural);
    return { dist: out, pNatural };
  }

  if (dr.length === 1) {
    const out = new Float64Array(6);
    const pNatural = accumulateFromUpcard(ctx, dr[0], 1, out);
    renormaliseOnNoNatural(out, pNatural);
    return { dist: out, pNatural };
  }

  const { total, isSoft } = totalOf(dr);
  return { dist: dealerFrom(ctx, total, isSoft), pNatural: 0 };
}

/**
 * Build the first-order sensitivity table: the base distribution plus, for each rank,
 * the delta from removing one card of that rank.
 *
 * This is what lets the player recursion price the dealer without recomputing it per
 * node. It is EXACT for a single removed card, so doubleEV and the first hit card carry
 * no error at all; approximation only begins at two or more drawn cards.
 */
export function buildSensitivities(ctx: EngineContext): number {
  const root = dealerDistExact(ctx);
  const base = new Float64Array(6);
  for (let i = 0; i < 6; i++) base[i] = root.dist[i];
  ctx.base = base;
  ctx.delta = new Array(10).fill(null);

  // With replacement the shoe never changes, so every delta is zero.
  if (ctx.infinite) return root.pNatural;

  for (let r = 0; r < 10; r++) {
    if (ctx.counts[r] <= 0) continue;
    pushCard(ctx, r);
    const shifted = dealerDistExact(ctx);
    const delta = new Float64Array(6);
    for (let i = 0; i < 6; i++) delta[i] = shifted.dist[i] - base[i];
    ctx.delta[r] = delta;
    popCard(ctx, r);
  }

  return root.pNatural;
}

/** Dealer distribution at the current point of the player recursion. */
export function dealerDistAt(ctx: EngineContext): Float64Array {
  if (ctx.precision === "exact") return dealerDistExact(ctx).dist;

  const base = ctx.base;
  if (!base) throw new Error("buildSensitivities must run before dealerDistAt");

  let drawnAny = false;
  for (let r = 0; r < 10; r++) {
    if (ctx.drawn[r] !== 0) {
      drawnAny = true;
      break;
    }
  }
  if (!drawnAny) return base;

  const out = new Float64Array(6);
  for (let i = 0; i < 6; i++) out[i] = base[i];
  for (let r = 0; r < 10; r++) {
    const n = ctx.drawn[r];
    if (n === 0) continue;
    const d = ctx.delta[r];
    if (!d) continue;
    for (let i = 0; i < 6; i++) out[i] += n * d[i];
  }

  // A linear extrapolation can undershoot zero; clamp then renormalise so the result
  // is always a proper distribution.
  let sum = 0;
  for (let i = 0; i < 6; i++) {
    if (out[i] < 0) out[i] = 0;
    sum += out[i];
  }
  if (sum > 0) {
    const inv = 1 / sum;
    for (let i = 0; i < 6; i++) out[i] *= inv;
  }
  return out;
}
