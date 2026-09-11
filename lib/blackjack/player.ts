import { ACE } from "./cards";
import { BUST_IDX, dealerDistAt } from "./dealer";
import { addCard } from "./hand";
import { drawP, memoKey, popCard, pushCard, type EngineContext } from "./memo";
import type { Outcome } from "./types";

const BUST: Outcome = { ev: -1, win: 0, push: 0, loss: 1 };

/**
 * Probabilities for the player's FIRST draw.
 *
 * When the dealer shows an ace or a ten, the hole card was already dealt and peeked,
 * and conditioning on "not a natural" shifts the composition the player then draws
 * from. Ignoring that is the largest remaining modelling error (~5e-4 to 1e-3 EV);
 * applying it here makes doubleEV rigorous, since a double draws exactly one card.
 *
 * Exactly zero effect for upcards 2-9 (no natural possible) and in infinite mode
 * (with replacement the hole card is independent).
 */
export function rootDrawProbs(ctx: EngineContext): Float64Array {
  const p = new Float64Array(10);
  const x = ctx.peekRank;

  if (x === null || ctx.infinite || ctx.remaining <= 1) {
    for (let r = 0; r < 10; r++) p[r] = drawP(ctx, r);
    return p;
  }

  const nX = ctx.counts[x];
  const rem = ctx.remaining;
  const pNoNatural = 1 - nX / rem;
  if (pNoNatural <= 0) {
    for (let r = 0; r < 10; r++) p[r] = drawP(ctx, r);
    return p;
  }

  for (let r = 0; r < 10; r++) {
    const base = ctx.counts[r] / rem;
    if (base <= 0) {
      p[r] = 0;
      continue;
    }
    const nXAfter = nX - (r === x ? 1 : 0);
    p[r] = (base * (1 - nXAfter / (rem - 1))) / pNoNatural;
  }
  return p;
}

/**
 * Value of standing on `total` against a dealer distribution.
 *
 * Totals below 17 get push = 0 automatically, which is correct: a standing dealer
 * always holds at least 17.
 */
export function standEV(total: number, dist: Float64Array): Outcome {
  if (total > 21) return BUST;
  let win = dist[BUST_IDX];
  let push = 0;
  let loss = 0;
  for (let k = 17; k <= 21; k++) {
    const p = dist[k - 17];
    if (p === 0) continue;
    if (k < total) win += p;
    else if (k === total) push += p;
    else loss += p;
  }
  return { ev: win - loss, win, push, loss };
}

/**
 * Value of hitting, then continuing to play optimally.
 *
 * The bust branch deliberately performs NO shoe mutation and NO dealer lookup. That
 * single early exit is the difference between ~0.1ms and ~30ms for a hand like 16 vs 10.
 *
 * Note that optimal play does not bound the recursion depth — every draw sequence is
 * explored and the max only selects afterwards. Depth is bounded by the hard-total
 * argument instead.
 */
export function hitEV(
  ctx: EngineContext,
  total: number,
  isSoft: boolean,
  firstDrawProbs: Float64Array | null = null,
): Outcome {
  const canMemo = firstDrawProbs === null;
  const bucket = (total << 1) | (isSoft ? 1 : 0);
  if (canMemo) {
    const cached = ctx.hitMemo[bucket].get(memoKey(ctx));
    if (cached) {
      return { ev: cached[0], win: cached[1], push: cached[2], loss: cached[3] };
    }
  }

  let ev = 0;
  let win = 0;
  let push = 0;
  let loss = 0;

  for (let r = 0; r < 10; r++) {
    const p = firstDrawProbs ? firstDrawProbs[r] : drawP(ctx, r);
    if (p <= 0) continue;
    const next = addCard(total, isSoft, r);

    if (next.total > 21) {
      ev -= p;
      loss += p;
      continue;
    }

    pushCard(ctx, r);
    const stand = standEV(next.total, dealerDistAt(ctx));
    const hit = hitEV(ctx, next.total, next.isSoft);
    popCard(ctx, r);

    const best = hit.ev > stand.ev ? hit : stand;
    ev += p * best.ev;
    win += p * best.win;
    push += p * best.push;
    loss += p * best.loss;
  }

  ctx.playerNodes += 1;
  if (canMemo) {
    ctx.hitMemo[bucket].set(memoKey(ctx), Float64Array.of(ev, win, push, loss));
  }
  return { ev, win, push, loss };
}

/** One card, then forced stand. `ev` doubles; win/push/loss are probabilities and do not. */
export function doubleEV(
  ctx: EngineContext,
  total: number,
  isSoft: boolean,
  firstDrawProbs: Float64Array | null = null,
): Outcome {
  let ev = 0;
  let win = 0;
  let push = 0;
  let loss = 0;

  for (let r = 0; r < 10; r++) {
    const p = firstDrawProbs ? firstDrawProbs[r] : drawP(ctx, r);
    if (p <= 0) continue;
    const next = addCard(total, isSoft, r);

    if (next.total > 21) {
      ev -= p;
      loss += p;
      continue;
    }

    pushCard(ctx, r);
    const stand = standEV(next.total, dealerDistAt(ctx));
    popCard(ctx, r);

    ev += p * stand.ev;
    win += p * stand.win;
    push += p * stand.push;
    loss += p * stand.loss;
  }

  return { ev: 2 * ev, win, push, loss };
}

/**
 * Value of splitting a pair, modelled as 2 hands with no resplit.
 *
 * Both of the player's cards are already removed from the shoe at the root, so each
 * hand starts from one of them and draws from the correct composition. Sibling
 * depletion is ignored (measured at under 2e-4 EV), and `ev` is 2x one hand.
 *
 * Split aces receive one card and may not draw again. Other pairs play out fully,
 * including doubling after split.
 *
 * win/push/loss here describe ONE hand, not the pair — two hands can disagree, so
 * averaging them into a single "win %" would be meaningless.
 */
export function splitEV(
  ctx: EngineContext,
  pairRank: number,
  firstDrawProbs: Float64Array | null = null,
): Outcome {
  const start = addCard(0, false, pairRank);
  const acesOneCard = pairRank === ACE;

  let ev = 0;
  let win = 0;
  let push = 0;
  let loss = 0;

  for (let r = 0; r < 10; r++) {
    const p = firstDrawProbs ? firstDrawProbs[r] : drawP(ctx, r);
    if (p <= 0) continue;
    const next = addCard(start.total, start.isSoft, r);

    let best: Outcome;
    if (next.total > 21) {
      best = BUST;
    } else {
      pushCard(ctx, r);
      best = standEV(next.total, dealerDistAt(ctx));
      if (!acesOneCard) {
        const hit = hitEV(ctx, next.total, next.isSoft);
        if (hit.ev > best.ev) best = hit;
        const dbl = doubleEV(ctx, next.total, next.isSoft);
        if (dbl.ev > best.ev) best = dbl;
      }
      popCard(ctx, r);
    }

    ev += p * best.ev;
    win += p * best.win;
    push += p * best.push;
    loss += p * best.loss;
  }

  return { ev: 2 * ev, win, push, loss };
}
