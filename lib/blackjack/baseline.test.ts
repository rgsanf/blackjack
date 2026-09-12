import { describe, expect, it } from "vitest";
import { preDealOutcome } from "./baseline-compute";
import { PRE_DEAL, preDealBaseline } from "./baseline";
import type { DeckMode } from "./types";

const DECKS: [string, DeckMode][] = [
  ["1", { kind: "shoe", decks: 1 }],
  ["2", { kind: "shoe", decks: 2 }],
  ["4", { kind: "shoe", decks: 4 }],
  ["6", { kind: "shoe", decks: 6 }],
  ["8", { kind: "shoe", decks: 8 }],
  ["infinite", { kind: "infinite" }],
];

/**
 * The point of this file: a committed constant that nothing re-derives is a number
 * that silently goes stale the first time the engine changes. Slow on purpose - it
 * runs the full 1000-evaluation aggregation for all six deck counts.
 */
describe("pre-deal baseline table", () => {
  for (const [key, deck] of DECKS) {
    it(`${key} still matches what the engine computes`, { timeout: 20_000 }, () => {
      const got = preDealOutcome(deck);
      const want = PRE_DEAL[key];
      expect(got.win).toBeCloseTo(want.win, 6);
      expect(got.push).toBeCloseTo(want.push, 6);
      expect(got.loss).toBeCloseTo(want.loss, 6);
      expect(got.ev).toBeCloseTo(want.ev, 6);
    });
  }

  it("every row is a proper distribution", () => {
    for (const [key] of DECKS) {
      const r = PRE_DEAL[key];
      // 5 digits, not more: the table is rounded to six decimals, so the sum carries
      // up to ~1.5e-6 of rounding. The engine itself sums to 1 within 1e-9.
      expect(r.win + r.push + r.loss, key).toBeCloseTo(1, 5);
      for (const v of [r.win, r.push, r.loss]) expect(v, key).toBeGreaterThan(0);
    }
  });

  it("agrees with the separately locked house-edge figures", () => {
    // Same quantity, derived the same way in house-edge.test.ts. If these two ever
    // disagree, one of them was updated without the other.
    expect(-PRE_DEAL["8"].ev * 100).toBeCloseTo(0.4851, 3);
    expect(-PRE_DEAL.infinite.ev * 100).toBeCloseTo(0.5704, 3);
  });

  it("gets better for the player as decks come out", () => {
    const ev = (k: string) => PRE_DEAL[k].ev;
    expect(ev("1")).toBeGreaterThan(ev("2"));
    expect(ev("2")).toBeGreaterThan(ev("4"));
    expect(ev("4")).toBeGreaterThan(ev("6"));
    expect(ev("6")).toBeGreaterThan(ev("8"));
    expect(ev("8")).toBeGreaterThan(ev("infinite"));
  });

  it("resolves by deck option, and reports nothing for an unknown one", () => {
    expect(preDealBaseline(8)).toBe(PRE_DEAL["8"]);
    expect(preDealBaseline("infinite")).toBe(PRE_DEAL.infinite);
    expect(preDealBaseline(3)).toBeNull();
  });
});

describe("pre-deal deal facts", () => {
  it("player and dealer are equally likely to be dealt a natural", () => {
    // Same two cards off the same shoe, so the symmetry is exact rather than
    // approximate. Cross-checks the aggregation against the closed forms below.
    expect(PRE_DEAL.infinite.natural).toBeCloseTo(2 * (1 / 13) * (4 / 13), 6);
    expect(PRE_DEAL["8"].natural).toBeCloseTo(2 * (32 / 416) * (128 / 415), 6);
    expect(PRE_DEAL["1"].natural).toBeCloseTo(2 * (4 / 52) * (16 / 51), 6);
  });

  it("a stiff is the single most common opening hand", () => {
    for (const [key] of DECKS) {
      const r = PRE_DEAL[key];
      expect(r.stiff, key).toBeGreaterThan(0.38);
      expect(r.stiff, key).toBeLessThan(0.39);
      // Every opening hand is at most one of these, so they cannot overlap into >1.
      expect(r.stiff + r.natural, key).toBeLessThan(1);
    }
  });
});
