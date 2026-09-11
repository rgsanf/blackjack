import { HI_LO, rankLabel } from "./cards";
import { buildSensitivities, dealerDistExact } from "./dealer";
import { assertBalanced, createContext } from "./engine";
import { evaluateHand } from "./hand";
import { doubleEV, hitEV, rootDrawProbs, splitEV, standEV } from "./player";
import { APPROXIMATIONS, RULES } from "./rules";
import type { EngineContext } from "./memo";
import type {
  ActionEV,
  ActionKind,
  AnalysisResult,
  Card,
  DealerInfo,
  DealerOutcomes,
  Outcome,
  RankIndex,
  Resolution,
  ShoeInfo,
  TableState,
} from "./types";

const ACTIONS: readonly ActionKind[] = ["stand", "hit", "double", "split"];

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function toOutcomes(
  dist: Float64Array,
  pNatural: number,
  conditioned: boolean,
  exhausted: boolean,
): DealerOutcomes {
  return {
    p17: dist[0],
    p18: dist[1],
    p19: dist[2],
    p20: dist[3],
    p21: dist[4],
    pBust: dist[5],
    pNatural,
    conditionedOnNoNatural: conditioned,
    shoeExhausted: exhausted,
  };
}

function shoeInfo(ctx: EngineContext, seen: readonly Card[]): ShoeInfo {
  let rc = 0;
  for (const c of seen) rc += HI_LO[c.rank];
  const remaining = ctx.infinite ? 0 : ctx.remaining;
  const decksRemaining = ctx.infinite ? 0 : remaining / 52;
  return {
    counts: Array.from(ctx.counts),
    remaining,
    decks: ctx.decks,
    infinite: ctx.infinite,
    runningCount: rc,
    trueCount: decksRemaining > 0 ? rc / decksRemaining : 0,
    decksRemaining,
  };
}

function unavailable(action: ActionKind, reason: string): ActionEV {
  return {
    action,
    available: false,
    unavailableReason: reason,
    ev: null,
    unconditionalEV: null,
    outcome: null,
  };
}

function available(
  action: ActionKind,
  outcome: Outcome,
  pNat: number,
  note?: string,
): ActionEV {
  return {
    action,
    available: true,
    ev: outcome.ev,
    // Under peek rules the dealer's natural is settled before the player acts, so a
    // doubled or split bet is never exposed to it: the penalty is -1, not -2.
    unconditionalEV: pNat * -1 + (1 - pNat) * outcome.ev,
    outcome,
    note,
  };
}

/**
 * Single entry point. Total by construction: never throws, never returns NaN.
 *
 * Short-circuit ordering below is deliberate. Because both hands are freely editable,
 * every branch is genuinely reachable, including states no real game could produce
 * (a dealer holding 26, both sides bust, an eight-card player hand).
 */
export function analyze(state: TableState): AnalysisResult {
  const t0 = now();
  const precision = state.precision ?? "fast";
  const removedCards = state.removedCards ?? [];
  const seen: Card[] = [...state.dealerCards, ...state.playerCards, ...removedCards];

  const dealerRanks = state.dealerCards.map((c) => c.rank);
  const built = createContext({
    deck: state.deck,
    dealerRanks,
    removed: seen,
    precision,
  });

  // 1. Impossible shoe composition.
  if (!built.ok) {
    return {
      status: "invalid",
      reason: `More ${rankLabel(built.rank)}s are in play than exist in the shoe.`,
      offendingRank: built.rank,
    };
  }
  const ctx = built.ctx;
  const initialRemaining = ctx.remaining;

  // 2. Nothing left to draw.
  if (!ctx.infinite && ctx.remaining <= 0) {
    return { status: "invalid", reason: "The shoe is exhausted." };
  }

  const player = evaluateHand(state.playerCards);
  const dealer = evaluateHand(state.dealerCards);
  const shoe = shoeInfo(ctx, seen);

  // 3. No dealer card: nothing about the dealer is computable.
  if (dealer.cardCount === 0) {
    return {
      status: "incomplete",
      need: "dealerCards",
      shoe,
      player: player.cardCount > 0 ? player : null,
      dealer: null,
      pDealerBlackjack: null,
    };
  }

  const dealerNatural = dealer.isNatural;
  const rootPNat = buildSensitivities(ctx);
  const rootDist = ctx.base ?? dealerDistExact(ctx).dist;
  const pNat = dealerNatural ? 1 : rootPNat;

  const dealerOutcomes = dealerNatural
    ? toOutcomes(Float64Array.of(0, 0, 0, 0, 1, 0), 1, false, ctx.exhausted)
    : toOutcomes(
        rootDist,
        rootPNat,
        dealerRanks.length === 1 && rootPNat > 0,
        ctx.exhausted,
      );

  const dealerInfo: DealerInfo = {
    value: dealer,
    upcard: dealerRanks.length > 0 ? (dealerRanks[0] as RankIndex) : null,
    outcomes: dealerOutcomes,
  };

  // 4. No player card: show the dealer picture only.
  if (player.cardCount === 0) {
    return {
      status: "incomplete",
      need: "playerCards",
      shoe,
      player: null,
      dealer: dealerInfo,
      pDealerBlackjack: pNat,
    };
  }

  const warnings: string[] = [];
  if (ctx.exhausted) {
    warnings.push("The shoe runs dry before the dealer can finish drawing.");
  }
  if (dealer.isBust) {
    warnings.push("The dealer hand entered is already bust.");
  }

  const approximations: string[] = [];
  const actions: Record<ActionKind, ActionEV> = {
    stand: unavailable("stand", "not applicable"),
    hit: unavailable("hit", "not applicable"),
    double: unavailable("double", "not applicable"),
    split: unavailable("split", "not applicable"),
  };
  const byAction: Record<ActionKind, Outcome | null> = {
    stand: null,
    hit: null,
    double: null,
    split: null,
  };

  let standOutcome: Outcome;
  let resolution: Resolution;

  // 5. Dealer blackjack: the round is settled before the player acts.
  if (dealerNatural) {
    standOutcome = player.isNatural
      ? { ev: 0, win: 0, push: 1, loss: 0 }
      : { ev: -1, win: 0, push: 0, loss: 1 };
    actions.stand = {
      action: "stand",
      available: true,
      ev: standOutcome.ev,
      unconditionalEV: standOutcome.ev,
      outcome: standOutcome,
      note: player.isNatural ? "both blackjack - push" : "dealer blackjack",
    };
    byAction.stand = standOutcome;
    for (const a of ACTIONS) {
      if (a !== "stand") actions[a] = unavailable(a, "dealer has blackjack");
    }
    resolution = "dealerBlackjack";
  }
  // 6. Player bust: short-circuit before any dealer EV work.
  //    Outranks a dealer bust - if both are bust, the player still loses.
  else if (player.isBust) {
    standOutcome = { ev: -1, win: 0, push: 0, loss: 1 };
    actions.stand = available("stand", standOutcome, pNat);
    byAction.stand = standOutcome;
    for (const a of ACTIONS) {
      if (a !== "stand") actions[a] = unavailable(a, "hand is bust");
    }
    warnings.push("Your hand is bust - no action applies.");
    resolution = "playerBust";
  }
  // 7. Player natural: pays 3:2, pushes a dealer natural, admits no actions.
  else if (player.isNatural) {
    const win = 1 - pNat;
    standOutcome = { ev: RULES.blackjackPays * win, win, push: pNat, loss: 0 };
    actions.stand = {
      action: "stand",
      available: true,
      ev: standOutcome.ev,
      unconditionalEV: standOutcome.ev,
      outcome: standOutcome,
      note: "blackjack pays 3:2",
    };
    byAction.stand = standOutcome;
    for (const a of ACTIONS) {
      if (a !== "stand") actions[a] = unavailable(a, "you have blackjack");
    }
    resolution = "playerNatural";
  }
  // 8. Open hand: price every legal action.
  else {
    const firstDraw = rootDrawProbs(ctx);
    if (precision === "fast" && !ctx.infinite) {
      approximations.push(APPROXIMATIONS.dealerFirstOrder);
    }

    standOutcome = standEV(player.total, rootDist);
    actions.stand = available("stand", standOutcome, pNat);
    byAction.stand = standOutcome;

    if (player.canHit) {
      const o = hitEV(ctx, player.total, player.isSoft, firstDraw);
      actions.hit = available("hit", o, pNat);
      byAction.hit = o;
    } else {
      actions.hit = unavailable("hit", "cannot hit");
    }

    if (player.canDouble) {
      const o = doubleEV(ctx, player.total, player.isSoft, firstDraw);
      actions.double = available("double", o, pNat);
      byAction.double = o;
    } else {
      actions.double = unavailable(
        "double",
        player.cardCount > 2 ? "3+ cards" : "needs two cards",
      );
    }

    if (player.canSplit) {
      const o = splitEV(ctx, state.playerCards[0].rank, firstDraw);
      actions.split = available(
        "split",
        o,
        pNat,
        "2 hands, no resplit — W/P/L is per hand",
      );
      byAction.split = o;
      approximations.push(
        APPROXIMATIONS.splitNoResplit,
        APPROXIMATIONS.splitSiblingIndependence,
      );
    } else {
      actions.split = unavailable("split", "needs pair");
    }

    resolution = dealer.isBust ? "dealerBust" : "open";
  }

  let bestAction: ActionKind | null = null;
  let bestEv = Number.NEGATIVE_INFINITY;
  for (const a of ACTIONS) {
    const ae = actions[a];
    if (ae.available && ae.ev !== null && ae.ev > bestEv) {
      bestEv = ae.ev;
      bestAction = a;
    }
  }

  // Dev guard: catches any push without a matching pop anywhere in the recursion.
  assertBalanced(ctx, initialRemaining);

  return {
    status: "ok",
    shoe,
    player,
    dealer: dealerInfo,
    pDealerBlackjack: pNat,
    resolution,
    outcomes: {
      stand: standOutcome,
      best: bestAction ? byAction[bestAction] : null,
      byAction,
    },
    actions,
    bestAction,
    warnings,
    meta: {
      precision,
      computeMs: now() - t0,
      approximations,
      dealerNodes: ctx.dealerNodes,
      playerNodes: ctx.playerNodes,
    },
  };
}
