import type { Card, CardLabel, DeckMode, RankIndex, Suit } from "@/lib/blackjack";

export type DeckOption = 1 | 2 | 4 | 6 | 8 | "infinite";

export const DECK_OPTIONS: readonly DeckOption[] = [1, 2, 4, 6, 8, "infinite"];

export type TargetHand = "dealer" | "player";

export interface CalculatorState {
  decks: DeckOption;
  dealer: Card[];
  player: Card[];
  /** Counts of cards seen but in neither hand, by rank bucket (length 10). */
  discards: number[];
  target: TargetHand;
  /** Advances on every deal so consecutive cards never repeat a suit. */
  suitCursor: number;
  /**
   * Deterministic id source. A counter rather than randomUUID/Date.now because client
   * components are prerendered at build time and non-deterministic ids would cause a
   * hydration mismatch.
   */
  nextId: number;
}

export interface CalculatorHistory extends CalculatorState {
  past: CalculatorState[];
}

export type CalculatorAction =
  | { type: "addCard"; label: CardLabel; suit?: Suit }
  | { type: "removeCard"; hand: TargetHand; uid: number }
  | { type: "setTarget"; hand: TargetHand }
  | { type: "setDecks"; decks: DeckOption }
  | { type: "adjustDiscard"; rank: RankIndex; delta: number }
  | { type: "setDiscard"; rank: RankIndex; count: number }
  | { type: "clearHand"; hand: TargetHand }
  | { type: "clearDiscards" }
  | { type: "reset" }
  | { type: "undo" };

export function toDeckMode(decks: DeckOption): DeckMode {
  return decks === "infinite" ? { kind: "infinite" } : { kind: "shoe", decks };
}
