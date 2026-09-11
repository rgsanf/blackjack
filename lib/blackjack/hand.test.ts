import { describe, expect, it } from "vitest";
import { addCard, evaluateHand, totalOf } from "./hand";
import { LABEL_TO_RANK } from "./cards";
import type { CardLabel } from "./types";
import { hand } from "./testing";

function fold(...labels: CardLabel[]) {
  return totalOf(labels.map((l) => LABEL_TO_RANK[l]));
}

describe("soft-ace transitions", () => {
  /**
   * The classic trap is `isSoft = isSoft || isAce`, which reports A,2,A as 14 HARD.
   * A second ace must count 1 while the first keeps its 11, so the hand is 14 SOFT.
   */
  const cases: Array<[CardLabel[], number, boolean]> = [
    [["A"], 11, true],
    [["A", "A"], 12, true],
    [["A", "2", "A"], 14, true],
    [["A", "2", "A", "8"], 12, false],
    [["A", "A", "9"], 21, true],
    [["A", "A", "9", "2"], 13, false],
    [["A", "A", "10"], 12, false],
    [["10", "10", "A"], 21, false],
    [["A", "10"], 21, true],
    [["A", "5", "5"], 21, true],
    [["A", "5", "5", "A"], 12, false],
    [["10", "6"], 16, false],
    [["A", "7"], 18, true],
  ];

  for (const [labels, total, isSoft] of cases) {
    it(`${labels.join(",")} is ${total} ${isSoft ? "soft" : "hard"}`, () => {
      const got = fold(...labels);
      expect(got.total).toBe(total);
      expect(got.isSoft).toBe(isSoft);
    });
  }

  it("never leaves a soft hand above 21", () => {
    for (let total = 2; total <= 21; total++) {
      for (const soft of [true, false]) {
        for (let r = 0; r < 10; r++) {
          const next = addCard(total, soft, r);
          if (next.isSoft) expect(next.total).toBeLessThanOrEqual(21);
        }
      }
    }
  });
});

describe("hand classification", () => {
  it("treats two cards totalling 21 as a natural", () => {
    expect(evaluateHand(hand("A", "K")).isNatural).toBe(true);
    expect(evaluateHand(hand("10", "A")).isNatural).toBe(true);
  });

  it("does not treat a three-card 21 as a natural", () => {
    const h = evaluateHand(hand("7", "7", "7"));
    expect(h.total).toBe(21);
    expect(h.isNatural).toBe(false);
    // Still cannot double on three cards.
    expect(h.canDouble).toBe(false);
    expect(h.canHit).toBe(true);
  });

  it("treats 10,J as a pair because ten-valued cards share a bucket", () => {
    // This is rule-correct, not a shortcut: casinos allow splitting 10,J.
    expect(evaluateHand(hand("10", "J")).isPair).toBe(true);
    expect(evaluateHand(hand("Q", "K")).isPair).toBe(true);
    expect(evaluateHand(hand("10", "9")).isPair).toBe(false);
  });

  it("allows splitting aces but not a natural", () => {
    expect(evaluateHand(hand("A", "A")).canSplit).toBe(true);
    expect(evaluateHand(hand("A", "10")).canSplit).toBe(false);
    expect(evaluateHand(hand("A", "10")).canDouble).toBe(false);
  });

  it("reports hard totals with every ace as one", () => {
    expect(evaluateHand(hand("A", "A", "A")).hardTotal).toBe(3);
    expect(evaluateHand(hand("A", "A", "A")).total).toBe(13);
  });

  it("flags bust", () => {
    const h = evaluateHand(hand("10", "9", "5"));
    expect(h.total).toBe(24);
    expect(h.isBust).toBe(true);
    expect(h.canHit).toBe(false);
  });
});
