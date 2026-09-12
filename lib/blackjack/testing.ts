/**
 * Shared helpers for the engine test suite. Not part of the public surface.
 */
import { analyze } from "./analyze";
import { INFINITE_P } from "./cards";
import { cardFromLabel } from "./hand";
import type {
  AnalysisResult,
  Card,
  CardLabel,
  DealerOutcomes,
  DeckMode,
  Precision,
} from "./types";

let uid = 0;

export function card(label: CardLabel): Card {
  return cardFromLabel(label, uid++, "S");
}

export function hand(...labels: CardLabel[]): Card[] {
  return labels.map(card);
}

export const SHOE = (decks: number): DeckMode => ({ kind: "shoe", decks });
export const INFINITE: DeckMode = { kind: "infinite" };

/**
 * Dealer final-total distribution given only an upcard, as the published tables define
 * it. `removed` shifts the shoe composition the way discards would.
 */
export function dealerTable(
  up: CardLabel,
  deck: DeckMode,
  removed: CardLabel[] = [],
): DealerOutcomes {
  const res = analyze({
    deck,
    dealerCards: hand(up),
    playerCards: [],
    removedCards: hand(...removed),
  });
  if (res.status !== "incomplete") {
    throw new Error(`expected incomplete with dealer info, got ${res.status}`);
  }
  return res.dealer.outcomes;
}

/**
 * The pre-deal prior: the dealer's final-total distribution with NO dealer card known.
 * `removed` shifts the shoe composition the way discards or other players' cards would.
 */
export function priorTable(deck: DeckMode, removed: CardLabel[] = []): DealerOutcomes {
  const res = analyze({
    deck,
    dealerCards: [],
    playerCards: [],
    removedCards: hand(...removed),
  });
  if (res.status !== "incomplete") {
    throw new Error(`expected incomplete, got ${res.status}`);
  }
  return res.dealer.outcomes;
}

/** Root draw probability per rank bucket, matching what the engine sees at the root. */
export function rootDrawP(deck: DeckMode, removed: CardLabel[] = []): number[] {
  const res = analyze({
    deck,
    dealerCards: [],
    playerCards: [],
    removedCards: hand(...removed),
  });
  if (res.status !== "incomplete") throw new Error(`expected incomplete, got ${res.status}`);
  const { counts, remaining, infinite } = res.shoe;
  return infinite
    ? INFINITE_P.slice()
    : counts.map((c) => c / remaining);
}

/** [bust, 17, 18, 19, 20, 21] as percentages, matching the published table row order. */
export function asPercentRow(o: DealerOutcomes): number[] {
  return [o.pBust, o.p17, o.p18, o.p19, o.p20, o.p21].map((p) => p * 100);
}

export interface Spot {
  player: CardLabel[];
  dealer: CardLabel[];
  deck?: DeckMode;
  precision?: Precision;
}

export function ok(spot: Spot) {
  const res: AnalysisResult = analyze({
    deck: spot.deck ?? INFINITE,
    dealerCards: hand(...spot.dealer),
    playerCards: hand(...spot.player),
    precision: spot.precision,
  });
  if (res.status !== "ok") {
    throw new Error(`expected ok, got ${res.status}`);
  }
  return res;
}

export function evOf(spot: Spot) {
  const res = ok(spot);
  return {
    stand: res.actions.stand.ev,
    hit: res.actions.hit.ev,
    double: res.actions.double.ev,
    split: res.actions.split.ev,
    best: res.bestAction,
    res,
  };
}
