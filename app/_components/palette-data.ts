import type { CardLabel } from "@/lib/blackjack";

/** Palette order. Re-exported locally so components share one source of truth. */
export const CARD_LABELS: readonly CardLabel[] = [
  "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K",
];

/** Ten-valued labels share a single rank bucket, so their counts move together. */
export const TEN_LABELS: readonly CardLabel[] = ["10", "J", "Q", "K"];

/** Keyboard typeahead: what each key deals. */
export const KEY_TO_LABEL: Readonly<Record<string, CardLabel>> = {
  a: "A",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  "0": "10",
  t: "10",
  j: "J",
  q: "Q",
  k: "K",
};
