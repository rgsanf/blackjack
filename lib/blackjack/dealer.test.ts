import { describe, expect, it } from "vitest";
import { LABEL_TO_RANK } from "./cards";
import type { CardLabel } from "./types";
import {
  INFINITE,
  SHOE,
  asPercentRow,
  dealerTable,
  hand,
  priorTable,
  rootDrawP,
} from "./testing";
import { analyze } from "./analyze";

/**
 * Published dealer outcome tables, S17, conditional on the dealer NOT having blackjack
 * (US peek rules) - the same conditioning this engine uses.
 *
 * Source: blackjackinfo.com/dealer-outcome-probabilities. Independently reproduced by
 * a dynamic-programming implementation and a 20M-trial Monte Carlo during planning;
 * all three agree to every published digit.
 *
 * Row order: [bust, 17, 18, 19, 20, 21] as percentages.
 */
const UPCARDS: CardLabel[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "A"];

const INFINITE_S17: Record<string, number[]> = {
  "2": [35.36, 13.98, 13.49, 12.97, 12.40, 11.80],
  "3": [37.39, 13.50, 13.05, 12.56, 12.03, 11.47],
  "4": [39.45, 13.05, 12.59, 12.14, 11.65, 11.12],
  "5": [41.64, 12.23, 12.23, 11.77, 11.31, 10.82],
  "6": [42.32, 16.54, 10.63, 10.63, 10.17, 9.72],
  "7": [26.23, 36.86, 13.78, 7.86, 7.86, 7.41],
  "8": [24.47, 12.86, 35.93, 12.86, 6.94, 6.94],
  "9": [22.84, 12.00, 12.00, 35.08, 12.00, 6.08],
  "10": [22.98, 12.07, 12.07, 12.07, 37.07, 3.74],
  A: [16.65, 18.89, 18.89, 18.89, 18.89, 7.78],
};

const EIGHT_DECK_S17: Record<string, number[]> = {
  "2": [35.35, 13.97, 13.45, 12.99, 12.40, 11.83],
  "3": [37.41, 13.45, 13.05, 12.53, 12.07, 11.49],
  "4": [39.55, 13.05, 12.45, 12.13, 11.65, 11.17],
  "5": [41.79, 12.19, 12.24, 11.76, 11.21, 10.80],
  "6": [42.29, 16.56, 10.62, 10.64, 10.16, 9.72],
  "7": [26.20, 36.90, 13.79, 7.85, 7.87, 7.39],
  "8": [24.40, 12.88, 35.98, 12.87, 6.93, 6.95],
  "9": [22.90, 12.02, 11.80, 35.16, 12.03, 6.09],
  "10": [23.01, 12.11, 12.09, 12.12, 36.90, 3.76],
  A: [16.69, 18.83, 18.92, 18.89, 18.93, 7.75],
};

const LABELS = ["bust", "17", "18", "19", "20", "21"];

describe("dealer distribution, infinite deck, S17", () => {
  for (const up of UPCARDS) {
    it(`upcard ${up} matches the published row`, () => {
      const row = asPercentRow(dealerTable(up, INFINITE));
      const want = INFINITE_S17[up];
      row.forEach((got, i) => {
        expect(got, `${up} -> ${LABELS[i]}`).toBeCloseTo(want[i], 1);
        expect(Math.abs(got - want[i]), `${up} -> ${LABELS[i]}`).toBeLessThan(0.015);
      });
    });
  }

  it("every column sums to 100%", () => {
    for (const up of UPCARDS) {
      const sum = asPercentRow(dealerTable(up, INFINITE)).reduce((a, b) => a + b, 0);
      expect(sum, `upcard ${up}`).toBeCloseTo(100, 8);
    }
  });
});

describe("dealer distribution, 8 decks, S17", () => {
  // Passing both this and the infinite table proves card removal is actually active
  // and correct: the two tables differ only in the third significant digit.
  for (const up of UPCARDS) {
    it(`upcard ${up} matches the published row`, () => {
      const row = asPercentRow(dealerTable(up, SHOE(8)));
      const want = EIGHT_DECK_S17[up];
      row.forEach((got, i) => {
        expect(Math.abs(got - want[i]), `${up} -> ${LABELS[i]} got ${got}`).toBeLessThan(
          0.015,
        );
      });
    });
  }
});

describe("S17 signatures", () => {
  it("upcard 6 stands on soft 17, lifting the 17 row to ~16.5%", () => {
    // The single clearest tell that S17 is implemented and not H17, where this
    // would read ~11.5% instead.
    expect(dealerTable("6", INFINITE).p17 * 100).toBeCloseTo(16.54, 1);
    expect(dealerTable("6", SHOE(8)).p17 * 100).toBeCloseTo(16.56, 1);
  });

  it("a dealer holding A,6 stands on soft 17 with certainty", () => {
    const res = analyze({
      deck: SHOE(8),
      dealerCards: hand("A", "6"),
      playerCards: hand("10", "9"),
    });
    if (res.status !== "ok") throw new Error(res.status);
    expect(res.dealer.outcomes.p17).toBeCloseTo(1, 12);
    expect(res.dealer.outcomes.pBust).toBeCloseTo(0, 12);
  });
});

describe("dealer blackjack probability", () => {
  it("matches the closed form for 8 decks", () => {
    // Upcard ace with two non-ten player cards removed: 128 tens among 413 unseen.
    const withAce = analyze({
      deck: SHOE(8),
      dealerCards: hand("A"),
      playerCards: hand("7", "8"),
    });
    if (withAce.status !== "ok") throw new Error(withAce.status);
    expect(withAce.pDealerBlackjack).toBeCloseTo(128 / 413, 12);

    // Upcard ten with player 10,6: 32 aces among 413 unseen.
    const withTen = analyze({
      deck: SHOE(8),
      dealerCards: hand("10"),
      playerCards: hand("10", "6"),
    });
    if (withTen.status !== "ok") throw new Error(withTen.status);
    expect(withTen.pDealerBlackjack).toBeCloseTo(32 / 413, 12);
  });

  it("matches the closed form for an infinite deck", () => {
    expect(dealerTable("A", INFINITE).pNatural).toBeCloseTo(4 / 13, 12);
    expect(dealerTable("10", INFINITE).pNatural).toBeCloseTo(1 / 13, 12);
  });

  it("is zero for upcards that cannot make a natural", () => {
    for (const up of ["2", "3", "4", "5", "6", "7", "8", "9"] as CardLabel[]) {
      expect(dealerTable(up, SHOE(8)).pNatural, `upcard ${up}`).toBe(0);
    }
  });

  it("is zero once both dealer cards are known", () => {
    const res = analyze({
      deck: SHOE(8),
      dealerCards: hand("A", "5"),
      playerCards: hand("10", "9"),
    });
    if (res.status !== "ok") throw new Error(res.status);
    expect(res.dealer.outcomes.pNatural).toBe(0);
    expect(res.dealer.outcomes.conditionedOnNoNatural).toBe(false);
  });
});

describe("pre-deal prior (no dealer card)", () => {
  const KEYS = ["p17", "p18", "p19", "p20", "p21", "pBust"] as const;

  it("is a proper distribution at every deck count", () => {
    for (const deck of [INFINITE, SHOE(1), SHOE(2), SHOE(4), SHOE(6), SHOE(8)]) {
      const o = priorTable(deck);
      const sum = KEYS.reduce((a, k) => a + o[k], 0);
      expect(sum, `deck ${JSON.stringify(deck)}`).toBeCloseTo(1, 12);
      for (const k of KEYS) expect(o[k], `${k}`).toBeGreaterThan(0);
    }
  });

  /**
   * The strongest available check: the prior must be the upcard-weighted average of
   * the ten published rows, weighted by P(upcard) AND by P(no natural | upcard).
   *
   * Weighting by P(upcard) alone is the tempting mistake. It double-counts blackjacks:
   * each row is already conditioned on its own upcard not making one, so the rows are
   * conditioned on different events and cannot be averaged without the second factor.
   */
  for (const [name, deck] of [
    ["infinite deck", INFINITE],
    ["8 decks", SHOE(8)],
    ["1 deck", SHOE(1)],
  ] as const) {
    it(`matches the no-natural-weighted average of the upcard rows, ${name}`, () => {
      const p = rootDrawP(deck);
      const want = { p17: 0, p18: 0, p19: 0, p20: 0, p21: 0, pBust: 0 };
      let mass = 0;

      for (const up of UPCARDS) {
        const row = dealerTable(up, deck);
        const w = p[LABEL_TO_RANK[up]] * (1 - row.pNatural);
        mass += w;
        for (const k of KEYS) want[k] += w * row[k];
      }

      const got = priorTable(deck);
      for (const k of KEYS) {
        expect(got[k], `${k}`).toBeCloseTo(want[k] / mass, 12);
      }
      expect(got.pNatural).toBeCloseTo(1 - mass, 12);
    });
  }

  it("P(blackjack) matches the closed form before any card is dealt", () => {
    // Two orderings (ace-then-ten, ten-then-ace), hence the factor of 2.
    expect(priorTable(INFINITE).pNatural).toBeCloseTo(2 * (1 / 13) * (4 / 13), 12);
    expect(priorTable(SHOE(8)).pNatural).toBeCloseTo(2 * (32 / 416) * (128 / 415), 12);
    expect(priorTable(SHOE(1)).pNatural).toBeCloseTo(2 * (4 / 52) * (16 / 51), 12);
  });

  it("removes the upcard before drawing the hole card", () => {
    // The tell at one deck: if the upcard were not removed, an ace up would still see
    // 16 tens rather than 16 of 51, and P(blackjack) would come out at 2*(4/52)*(16/52).
    expect(priorTable(SHOE(1)).pNatural).not.toBeCloseTo(2 * (4 / 52) * (16 / 52), 6);
  });

  it("tracks the shoe: burning every ace removes blackjack entirely", () => {
    const drained = priorTable(SHOE(1), ["A", "A", "A", "A"]);
    expect(drained.pNatural).toBe(0);
    expect(drained.conditionedOnNoNatural).toBe(false);
    expect(KEYS.reduce((a, k) => a + drained[k], 0)).toBeCloseTo(1, 12);
  });

  it("tracks the shoe: stripping small cards makes the dealer stronger, not weaker", () => {
    // Worth pinning down, because it inverts the familiar card-counting intuition.
    // "A high count means the dealer busts more" is conditional on a STIFF upcard:
    // with 6 up, stripping 2-6 lifts the bust rate from ~42% to ~49%.
    //
    // The prior averages over all ten upcards, and there the opposite dominates: a
    // ten-heavy shoe deals the dealer more two-card pat hands, so bust FALLS and 20
    // rises. Asserting the counting intuition here would enshrine a real bug.
    const strip: CardLabel[] = ["2", "3", "4", "5", "6", "6", "5", "4"];
    const fresh = priorTable(SHOE(1));
    const noSmall = priorTable(SHOE(1), strip);

    expect(noSmall.pBust).toBeLessThan(fresh.pBust);
    expect(noSmall.p20).toBeGreaterThan(fresh.p20);
    expect(noSmall.pNatural).toBeGreaterThan(fresh.pNatural);

    // The conditional claim in the comment above, pinned so it cannot rot.
    expect(dealerTable("6", SHOE(1), strip).pBust).toBeGreaterThan(
      dealerTable("6", SHOE(1)).pBust,
    );
  });

  it("is reported through analyze with no upcard and no player EV", () => {
    const res = analyze({ deck: SHOE(6), dealerCards: [], playerCards: hand("10", "6") });
    if (res.status !== "incomplete") throw new Error(res.status);
    expect(res.need).toBe("dealerCards");
    expect(res.dealer.upcard).toBeNull();
    expect(res.dealer.value.cardCount).toBe(0);
    expect(res.player?.total).toBe(16);
    expect(res.pDealerBlackjack).toBeGreaterThan(0);
  });

  it("accounts for the player's own cards", () => {
    // Holding both remaining aces at one deck cannot leave the dealer a natural.
    const bare = priorTable(SHOE(1));
    const res = analyze({
      deck: SHOE(1),
      dealerCards: [],
      playerCards: hand("A", "A"),
      removedCards: hand("A", "A"),
    });
    if (res.status !== "incomplete") throw new Error(res.status);
    expect(res.dealer.outcomes.pNatural).toBe(0);
    expect(res.dealer.outcomes.pBust).not.toBeCloseTo(bare.pBust, 6);
  });
});
