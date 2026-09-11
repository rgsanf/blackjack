import type { CardLabel, RankIndex, Suit } from "./types";

/** Ace shown as 11; softness is handled in addCard. Index is RankIndex. */
export const RANK_VALUE = [11, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export const ACE: RankIndex = 0;
export const TEN: RankIndex = 9;

/** Palette order, and the display labels the user clicks. */
export const CARD_LABELS: readonly CardLabel[] = [
  "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K",
];

export const LABEL_TO_RANK: Readonly<Record<CardLabel, RankIndex>> = {
  A: 0, "2": 1, "3": 2, "4": 3, "5": 4, "6": 5,
  "7": 6, "8": 7, "9": 8, "10": 9, J: 9, Q: 9, K: 9,
};

/** Spoken names, for screen-reader labels. */
export const RANK_NAMES: Readonly<Record<CardLabel, string>> = {
  A: "ace", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six",
  "7": "seven", "8": "eight", "9": "nine", "10": "ten",
  J: "jack", Q: "queen", K: "king",
};

export const SUITS: readonly Suit[] = ["S", "H", "D", "C"];

export const SUIT_GLYPH: Readonly<Record<Suit, string>> = {
  S: "\u2660", H: "\u2665", D: "\u2666", C: "\u2663",
};

export const SUIT_IS_RED: Readonly<Record<Suit, boolean>> = {
  S: false, C: false, H: true, D: true,
};

/** Hi-Lo tag by rank bucket: 2-6 are +1, 7-9 are 0, tens and aces are -1. */
export const HI_LO = [-1, 1, 1, 1, 1, 1, 0, 0, 0, -1] as const;

/** Cards of each rank bucket per 52-card deck: four of each rank, sixteen tens. */
export const PER_DECK = [4, 4, 4, 4, 4, 4, 4, 4, 4, 16] as const;

/** Infinite-deck draw probability by bucket: 1/13, except tens at 4/13. */
export const INFINITE_P = [
  1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13,
  1 / 13, 1 / 13, 1 / 13, 4 / 13,
] as const;

/** Short display label for a rank bucket (bucket 9 covers all ten-valued cards). */
export function rankLabel(rank: RankIndex): string {
  return rank === 0 ? "A" : rank === 9 ? "10" : String(rank + 1);
}
