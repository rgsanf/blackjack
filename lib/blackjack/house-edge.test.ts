import { describe, expect, it } from "vitest";
import { analyze } from "./analyze";
import { PER_DECK } from "./cards";
import { cardFromLabel } from "./hand";
import type { CardLabel, DeckMode } from "./types";

const RANK_LABELS: CardLabel[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

let uid = 0;
const c = (l: CardLabel) => cardFromLabel(l, uid++, "S");

/**
 * First-round expected value under optimal play, summed over every possible opening
 * deal (ordered player pair x dealer upcard) weighted by its exact probability.
 *
 * Uses `unconditionalEV`, which folds in the dealer-blackjack case, so the result is
 * the true expectation of the round rather than a decision-conditional figure.
 */
function firstRoundEV(deck: DeckMode): { ev: number; mass: number } {
  const infinite = deck.kind === "infinite";
  const decks = infinite ? 1 : deck.decks;
  const base = RANK_LABELS.map((_, r) => PER_DECK[r] * decks);
  const total = base.reduce((a, b) => a + b, 0);
  const infP = (r: number) => (r === 9 ? 4 / 13 : 1 / 13);

  let ev = 0;
  let mass = 0;

  for (let p1 = 0; p1 < 10; p1++) {
    for (let p2 = 0; p2 < 10; p2++) {
      for (let up = 0; up < 10; up++) {
        let prob: number;
        if (infinite) {
          prob = infP(p1) * infP(p2) * infP(up);
        } else {
          const left = base.slice();
          if (left[p1] <= 0) continue;
          const q1 = left[p1] / total;
          left[p1] -= 1;
          if (left[p2] <= 0) continue;
          const q2 = left[p2] / (total - 1);
          left[p2] -= 1;
          if (left[up] <= 0) continue;
          const q3 = left[up] / (total - 2);
          prob = q1 * q2 * q3;
        }
        if (prob <= 0) continue;

        const res = analyze({
          deck,
          dealerCards: [c(RANK_LABELS[up])],
          playerCards: [c(RANK_LABELS[p1]), c(RANK_LABELS[p2])],
        });
        if (res.status !== "ok" || !res.bestAction) continue;
        ev += prob * res.actions[res.bestAction].unconditionalEV!;
        mass += prob;
      }
    }
  }
  return { ev, mass };
}

describe("house edge", () => {
  /**
   * These are THIS engine's own values, used as tight regression locks - not published
   * figures. They legitimately differ from the commonly quoted ~0.43-0.45% for 8-deck
   * S17/DAS because this model does not resplit (which raises the edge by roughly
   * 0.05%) while it does play composition-dependently rather than off a chart (which
   * lowers it).
   *
   * The infinite-deck figure of 0.5704% was reproduced to all four decimals by a
   * separately written reference implementation during planning.
   */
  it("8 decks lands on the locked value and inside a sane band", () => {
    const { ev, mass } = firstRoundEV({ kind: "shoe", decks: 8 });
    expect(mass).toBeCloseTo(1, 9);
    const edge = -ev * 100;
    expect(edge).toBeCloseTo(0.4851, 2);
    expect(edge).toBeGreaterThan(0.3);
    expect(edge).toBeLessThan(0.6);
  });

  it("infinite deck lands on the locked value", () => {
    const { ev, mass } = firstRoundEV({ kind: "infinite" });
    expect(mass).toBeCloseTo(1, 9);
    expect(-ev * 100).toBeCloseTo(0.5704, 2);
  });

  /**
   * Internal consistency: fewer decks favour the player, and the 8-deck-to-infinite
   * gap should sit near the known ~0.07% deck-count effect.
   */
  it("gets better for the player as decks come out", () => {
    const eight = -firstRoundEV({ kind: "shoe", decks: 8 }).ev;
    const two = -firstRoundEV({ kind: "shoe", decks: 2 }).ev;
    const infinite = -firstRoundEV({ kind: "infinite" }).ev;
    expect(two).toBeLessThan(eight);
    expect(eight).toBeLessThan(infinite);
    expect((infinite - eight) * 100).toBeCloseTo(0.085, 1);
  });
});
