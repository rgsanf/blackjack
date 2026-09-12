/**
 * Core types for the blackjack odds engine.
 *
 * Rank buckets: the engine works in 10 buckets, not 13 ranks, because 10/J/Q/K are
 * mathematically identical. This is also rule-correct — casinos let you split 10,J —
 * so `isPair` is right by construction rather than by special case.
 */

/** 0 = ace, 1..8 = 2..9, 9 = any ten-valued card (10/J/Q/K). */
export type RankIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** What the user actually clicked. Purely for display; the engine only sees RankIndex. */
export type CardLabel =
  | "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

/** Cosmetic only. The engine never reads this. */
export type Suit = "S" | "H" | "D" | "C";

export interface Card {
  readonly label: CardLabel;
  readonly rank: RankIndex;
  /** Monotonic counter so React keys stay stable when removing the first of two equal cards. */
  readonly uid: number;
  readonly suit: Suit;
}

export type DeckMode =
  | { readonly kind: "shoe"; readonly decks: number }
  | { readonly kind: "infinite" };

/**
 * "fast" = first-order dealer sensitivity (default; ~2ms worst case, EV error ~1e-6).
 * "exact" = full recursion with per-node card removal (reference oracle; up to ~115ms).
 */
export type Precision = "fast" | "exact";

export type ActionKind = "stand" | "hit" | "double" | "split";

export interface HandValue {
  readonly cardCount: number;
  /** Best total: one ace counts 11 when it fits. */
  readonly total: number;
  /** All aces as 1. */
  readonly hardTotal: number;
  /** Exactly one ace is being counted as 11. */
  readonly isSoft: boolean;
  readonly isBust: boolean;
  /** Two cards totalling 21. Three-card 21 is NOT a natural. */
  readonly isNatural: boolean;
  readonly isPair: boolean;
  readonly canHit: boolean;
  readonly canDouble: boolean;
  readonly canSplit: boolean;
}

/**
 * Probabilities of each dealer final total, conditional on no dealer blackjack
 * whenever a dealer card is still unknown (US peek rules) - which covers both the
 * one-upcard case and the no-cards-dealt prior.
 */
export interface DealerOutcomes {
  readonly p17: number;
  readonly p18: number;
  readonly p19: number;
  readonly p20: number;
  readonly p21: number;
  readonly pBust: number;
  /** P(dealer blackjack). Zero once both dealer cards are known. */
  readonly pNatural: number;
  readonly conditionedOnNoNatural: boolean;
  readonly shoeExhausted: boolean;
}

/**
 * `ev` is in units of the initial bet and is NOT derivable from win/loss —
 * a double that wins pays +2 — so both are carried.
 */
export interface Outcome {
  readonly ev: number;
  readonly win: number;
  readonly push: number;
  readonly loss: number;
}

export interface ActionEV {
  readonly action: ActionKind;
  readonly available: boolean;
  readonly unavailableReason?: string;
  /** Conditional on no dealer blackjack. */
  readonly ev: number | null;
  /** -pNat + (1 - pNat) * ev */
  readonly unconditionalEV: number | null;
  readonly outcome: Outcome | null;
  readonly note?: string;
}

export interface ShoeInfo {
  readonly counts: readonly number[];
  readonly remaining: number;
  readonly decks: number | null;
  readonly infinite: boolean;
  /** Hi-Lo running count. */
  readonly runningCount: number;
  /** runningCount / decksRemaining */
  readonly trueCount: number;
  readonly decksRemaining: number;
}

export interface DealerInfo {
  readonly value: HandValue;
  readonly upcard: RankIndex | null;
  readonly outcomes: DealerOutcomes;
}

export type Resolution =
  | "open"
  | "playerNatural"
  | "dealerBlackjack"
  | "playerBust"
  | "dealerBust";

export interface TableState {
  readonly deck: DeckMode;
  readonly playerCards: readonly Card[];
  readonly dealerCards: readonly Card[];
  /** Cards seen but in neither hand (discards, other players, burns). */
  readonly removedCards?: readonly Card[];
  readonly precision?: Precision;
}

export interface AnalysisMeta {
  readonly precision: Precision;
  readonly computeMs: number;
  readonly approximations: readonly string[];
  readonly dealerNodes: number;
  readonly playerNodes: number;
}

export type AnalysisResult =
  | {
      readonly status: "invalid";
      readonly reason: string;
      readonly offendingRank?: RankIndex;
    }
  | {
      readonly status: "incomplete";
      readonly need: "playerCards" | "dealerCards";
      readonly shoe: ShoeInfo;
      readonly player: HandValue | null;
      /** Never null: with no dealer card this carries the pre-deal prior. */
      readonly dealer: DealerInfo;
      readonly pDealerBlackjack: number;
    }
  | {
      readonly status: "ok";
      readonly shoe: ShoeInfo;
      readonly player: HandValue;
      readonly dealer: DealerInfo;
      readonly pDealerBlackjack: number;
      readonly resolution: Resolution;
      readonly outcomes: {
        readonly stand: Outcome;
        readonly best: Outcome | null;
        readonly byAction: Readonly<Record<ActionKind, Outcome | null>>;
      };
      readonly actions: Readonly<Record<ActionKind, ActionEV>>;
      readonly bestAction: ActionKind | null;
      readonly warnings: readonly string[];
      readonly meta: AnalysisMeta;
    };
