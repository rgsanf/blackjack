import { describe, expect, it } from "vitest";
import { analyze } from "./analyze";
import { INFINITE, SHOE, hand } from "./testing";
import type { CardLabel } from "./types";

/**
 * Because the user edits both hands freely, every state below is genuinely reachable -
 * including several that no real game could ever produce. None may throw, return NaN,
 * or present confident-looking numbers for an impossible situation.
 */
describe("degenerate and impossible states", () => {
  it("reports incomplete with no cards at all", () => {
    const res = analyze({ deck: SHOE(8), dealerCards: [], playerCards: [] });
    expect(res.status).toBe("incomplete");
    if (res.status !== "incomplete") return;
    expect(res.need).toBe("dealerCards");
    expect(res.player).toBeNull();
    expect(res.dealer).toBeNull();
  });

  it("reports incomplete when only the player has cards", () => {
    const res = analyze({ deck: SHOE(8), dealerCards: [], playerCards: hand("10", "6") });
    expect(res.status).toBe("incomplete");
    if (res.status !== "incomplete") return;
    expect(res.need).toBe("dealerCards");
    expect(res.player?.total).toBe(16);
  });

  it("shows the dealer picture when only the dealer has cards", () => {
    const res = analyze({ deck: SHOE(8), dealerCards: hand("A"), playerCards: [] });
    expect(res.status).toBe("incomplete");
    if (res.status !== "incomplete") return;
    expect(res.need).toBe("playerCards");
    expect(res.dealer?.outcomes.pBust).toBeGreaterThan(0);
    expect(res.pDealerBlackjack).toBeCloseTo(128 / 415, 6);
  });

  it("prices hitting on a single player card", () => {
    // No action is legal on one card, but "EV once the second card arrives" is
    // well-defined and useful while the user is mid-entry.
    const res = analyze({ deck: SHOE(8), dealerCards: hand("6"), playerCards: hand("10") });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.actions.hit.available).toBe(true);
    expect(res.actions.double.available).toBe(false);
    expect(res.actions.split.available).toBe(false);
    expect(Number.isFinite(res.actions.hit.ev!)).toBe(true);
  });

  it("short-circuits a bust player hand", () => {
    const res = analyze({
      deck: SHOE(8),
      dealerCards: hand("6"),
      playerCards: hand("10", "9", "5"),
    });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.resolution).toBe("playerBust");
    expect(res.actions.stand.ev).toBe(-1);
    expect(res.actions.hit.available).toBe(false);
    expect(res.warnings.length).toBeGreaterThan(0);
    // The dealer distribution is still shown - the user asked to see it.
    expect(res.dealer.outcomes.pBust).toBeGreaterThan(0);
  });

  it("treats a bust dealer hand as a certain win", () => {
    const res = analyze({
      deck: SHOE(8),
      dealerCards: hand("10", "9", "5"),
      playerCards: hand("10", "7"),
    });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.resolution).toBe("dealerBust");
    expect(res.dealer.outcomes.pBust).toBe(1);
    expect(res.actions.stand.ev).toBeCloseTo(1, 12);
  });

  it("lets the player lose when BOTH hands are bust", () => {
    // Player bust must outrank dealer bust: you lose before the dealer ever draws.
    const res = analyze({
      deck: SHOE(8),
      dealerCards: hand("10", "9", "5"),
      playerCards: hand("10", "9", "6"),
    });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.resolution).toBe("playerBust");
    expect(res.actions.stand.ev).toBe(-1);
  });

  it("handles a three-card 21, which is not a natural", () => {
    const res = analyze({
      deck: SHOE(8),
      dealerCards: hand("10"),
      playerCards: hand("7", "7", "7"),
    });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.resolution).toBe("open");
    expect(res.player.isNatural).toBe(false);
    // Pays 1:1 and pushes a dealer non-natural 21, so well short of 1.5.
    expect(res.actions.stand.ev!).toBeLessThan(1);
    expect(res.actions.stand.ev!).toBeGreaterThan(0.8);
    expect(res.actions.double.available).toBe(false);
    expect(res.bestAction).toBe("stand");
  });

  it("rejects a hand the shoe cannot contain", () => {
    // Five aces in a single deck.
    const res = analyze({
      deck: SHOE(1),
      dealerCards: hand("A", "A"),
      playerCards: hand("A", "A", "A"),
    });
    expect(res.status).toBe("invalid");
    if (res.status !== "invalid") return;
    expect(res.offendingRank).toBe(0);
    expect(res.reason).toMatch(/shoe/i);
  });

  it("allows in infinite mode what a real shoe would reject", () => {
    const res = analyze({
      deck: INFINITE,
      dealerCards: hand("A", "A"),
      playerCards: hand("A", "A", "A"),
    });
    expect(res.status).toBe("ok");
  });

  it("handles a rank fully exhausted from the shoe", () => {
    // All four aces of a single deck are on the table.
    const res = analyze({
      deck: SHOE(1),
      dealerCards: hand("A", "A"),
      playerCards: hand("A", "A"),
    });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.shoe.counts[0]).toBe(0);
    expect(Number.isFinite(res.actions.stand.ev!)).toBe(true);
  });

  it("survives a nearly exhausted shoe", () => {
    // Strip a single deck down to a handful of cards.
    const seen: CardLabel[] = [];
    for (const l of ["2", "3", "4", "5", "6", "7", "8", "9"] as CardLabel[]) {
      seen.push(l, l, l, l);
    }
    for (let i = 0; i < 15; i++) seen.push("10");
    const res = analyze({
      deck: SHOE(1),
      dealerCards: hand("10"),
      playerCards: hand("A", "A"),
      removedCards: hand(...seen),
    });
    expect(["ok", "invalid"]).toContain(res.status);
    if (res.status === "ok") {
      expect(Number.isFinite(res.actions.stand.ev!)).toBe(true);
    }
  });

  it("keeps a long player hand finite", () => {
    const res = analyze({
      deck: SHOE(8),
      dealerCards: hand("6"),
      playerCards: hand("A", "A", "A", "A", "A", "A", "2"),
    });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.player.total).toBe(18);
    expect(Number.isFinite(res.actions.stand.ev!)).toBe(true);
  });
});

describe("counting readouts", () => {
  it("computes the Hi-Lo running and true count", () => {
    // Four low cards seen: running count +4 against most of a single deck.
    const res = analyze({
      deck: SHOE(8),
      dealerCards: hand("6"),
      playerCards: hand("4", "5"),
      removedCards: hand("3", "2"),
    });
    if (res.status !== "ok") throw new Error(res.status);
    expect(res.shoe.runningCount).toBe(5);
    expect(res.shoe.remaining).toBe(416 - 5);
    expect(res.shoe.trueCount).toBeCloseTo(5 / ((416 - 5) / 52), 6);
  });

  it("counts tens and aces as minus one", () => {
    const res = analyze({
      deck: SHOE(8),
      dealerCards: hand("K"),
      playerCards: hand("A", "10"),
    });
    if (res.status !== "ok") throw new Error(res.status);
    expect(res.shoe.runningCount).toBe(-3);
  });

  it("reports infinite shoes as having no meaningful count", () => {
    const res = analyze({ deck: INFINITE, dealerCards: hand("6"), playerCards: hand("4", "5") });
    if (res.status !== "ok") throw new Error(res.status);
    expect(res.shoe.infinite).toBe(true);
    expect(res.shoe.decks).toBeNull();
    // The UI shows "-" for these rather than a misleading number.
    expect(res.shoe.trueCount).toBe(0);
  });
});
