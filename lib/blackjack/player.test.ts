import { describe, expect, it } from "vitest";
import { INFINITE, SHOE, evOf, ok } from "./testing";
import type { CardLabel } from "./types";

/**
 * Canonical infinite-deck, S17, peek-conditioned expected values.
 *
 * The 16-vs-10 pair (-0.540430 stand / -0.539826 hit) is published verbatim in the
 * standard infinite-deck EV tables, and is independently confirmable by hand: dealer-10
 * bust is 22.978%, so standing is 0.22978 - 0.77022 = -0.5404.
 */
describe("canonical EVs, infinite deck", () => {
  const cases: Array<{
    name: string;
    player: CardLabel[];
    dealer: CardLabel[];
    stand?: number;
    hit?: number;
    double?: number;
  }> = [
    { name: "hard 16 vs 10", player: ["10", "6"], dealer: ["10"], stand: -0.540430, hit: -0.539826, double: -1.079653 },
    { name: "hard 12 vs 4", player: ["10", "2"], dealer: ["4"], stand: -0.211063, hit: -0.213537, double: -0.427073 },
    { name: "hard 11 vs 10", player: ["6", "5"], dealer: ["10"], stand: -0.540430, hit: 0.119482, double: 0.179689 },
    { name: "hard 11 vs A", player: ["6", "5"], dealer: ["A"], stand: -0.666951, hit: 0.143001, double: 0.109061 },
    { name: "soft 18 vs 2", player: ["A", "7"], dealer: ["2"], stand: 0.121742, hit: 0.062905, double: 0.119750 },
    { name: "soft 18 vs 9", player: ["A", "7"], dealer: ["9"], stand: -0.183163, hit: -0.100744, double: -0.290219 },
    { name: "hard 20 vs 10", player: ["10", "10"], dealer: ["10"], stand: 0.554538 },
    { name: "hard 17 vs 7", player: ["10", "7"], dealer: ["7"], stand: -0.106809 },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const got = evOf({ player: c.player, dealer: c.dealer, deck: INFINITE });
      if (c.stand !== undefined) expect(got.stand!).toBeCloseTo(c.stand, 5);
      if (c.hit !== undefined) expect(got.hit!).toBeCloseTo(c.hit, 5);
      if (c.double !== undefined) expect(got.double!).toBeCloseTo(c.double, 5);
    });
  }

  it("stand 20 vs 10 splits into the published win/push/loss", () => {
    const res = ok({ player: ["10", "10"], dealer: ["10"], deck: INFINITE });
    const o = res.outcomes.stand;
    expect(o.win * 100).toBeCloseTo(59.191, 2);
    expect(o.push * 100).toBeCloseTo(37.071, 2);
    expect(o.loss * 100).toBeCloseTo(3.738, 2);
  });

  it("stand 17 vs 7 splits into the published win/push/loss", () => {
    const res = ok({ player: ["10", "7"], dealer: ["7"], deck: INFINITE });
    const o = res.outcomes.stand;
    expect(o.win * 100).toBeCloseTo(26.231, 2);
    expect(o.push * 100).toBeCloseTo(36.857, 2);
    expect(o.loss * 100).toBeCloseTo(36.912, 2);
  });
});

describe("strategy-critical decisions", () => {
  /**
   * 12 vs 4 stands by only ~0.0025, so this asserts BOTH EVs rather than just the
   * argmax - otherwise a tiny regression flips the decision with no diagnostic.
   */
  it("12 vs 4 stands, narrowly", () => {
    const got = evOf({ player: ["10", "2"], dealer: ["4"], deck: SHOE(8) });
    expect(got.stand!).toBeGreaterThan(got.hit!);
    expect(got.stand! - got.hit!).toBeLessThan(0.01);
    expect(got.best).toBe("stand");
  });

  /**
   * The S17 signature. Under H17 this hand doubles; under S17 it hits. A regression
   * that accidentally implements H17 shows up here.
   */
  it("11 vs A hits rather than doubles under S17", () => {
    for (const deck of [INFINITE, SHOE(8)]) {
      const got = evOf({ player: ["6", "5"], dealer: ["A"], deck });
      expect(got.hit!).toBeGreaterThan(got.double!);
      expect(got.best).toBe("hit");
    }
  });

  it("soft 18 vs 2 stands - also an S17 signature", () => {
    const got = evOf({ player: ["A", "7"], dealer: ["2"], deck: SHOE(8) });
    expect(got.best).toBe("stand");
  });

  it("11 vs 10 doubles", () => {
    const got = evOf({ player: ["6", "5"], dealer: ["10"], deck: SHOE(8) });
    expect(got.best).toBe("double");
  });

  it("16 vs 10 hits", () => {
    const got = evOf({ player: ["10", "6"], dealer: ["10"], deck: SHOE(8) });
    expect(got.best).toBe("hit");
  });

  it("splits aces and eights, never tens or fives", () => {
    expect(evOf({ player: ["A", "A"], dealer: ["10"], deck: SHOE(8) }).best).toBe("split");
    expect(evOf({ player: ["8", "8"], dealer: ["10"], deck: SHOE(8) }).best).toBe("split");
    expect(evOf({ player: ["10", "10"], dealer: ["6"], deck: SHOE(8) }).best).toBe("stand");
    expect(evOf({ player: ["5", "5"], dealer: ["5"], deck: SHOE(8) }).best).toBe("double");
  });

  it("stands on hard 17 and above, hits hard 8", () => {
    for (const up of ["2", "6", "7", "10", "A"] as CardLabel[]) {
      expect(evOf({ player: ["10", "7"], dealer: [up], deck: SHOE(8) }).best, `17 vs ${up}`).toBe("stand");
      expect(evOf({ player: ["5", "3"], dealer: [up], deck: SHOE(8) }).best, `8 vs ${up}`).toBe("hit");
    }
  });

  it("9,9 splits against 6 but stands against 7", () => {
    expect(evOf({ player: ["9", "9"], dealer: ["6"], deck: SHOE(8) }).best).toBe("split");
    expect(evOf({ player: ["9", "9"], dealer: ["7"], deck: SHOE(8) }).best).toBe("stand");
  });

  it("4,4 vs 5 splits - this is the double-after-split entry, not a chart mismatch", () => {
    // Charts drawn for no-DAS games say hit here. With DAS allowed, splitting wins.
    expect(evOf({ player: ["4", "4"], dealer: ["5"], deck: SHOE(8) }).best).toBe("split");
  });
});

describe("naturals", () => {
  it("pays 3:2 and pushes against a possible dealer natural", () => {
    const res = ok({ player: ["A", "K"], dealer: ["6"], deck: INFINITE });
    expect(res.resolution).toBe("playerNatural");
    // Dealer 6 cannot have a natural, so this is a clean 3:2.
    expect(res.actions.stand.ev).toBeCloseTo(1.5, 12);
    expect(res.actions.hit.available).toBe(false);
    expect(res.actions.double.available).toBe(false);
  });

  it("discounts a natural by the dealer natural chance", () => {
    const res = ok({ player: ["A", "K"], dealer: ["A"], deck: INFINITE });
    // pNat = 4/13 with one ten already gone from the player's hand? Infinite deck: 4/13.
    const pNat = 4 / 13;
    expect(res.pDealerBlackjack).toBeCloseTo(pNat, 12);
    expect(res.actions.stand.ev).toBeCloseTo(1.5 * (1 - pNat), 12);
    expect(res.outcomes.stand.push).toBeCloseTo(pNat, 12);
  });

  it("pushes when both hold a natural", () => {
    const res = ok({ player: ["A", "K"], dealer: ["A", "Q"], deck: SHOE(8) });
    expect(res.resolution).toBe("dealerBlackjack");
    expect(res.actions.stand.ev).toBe(0);
    expect(res.outcomes.stand.push).toBe(1);
  });
});
