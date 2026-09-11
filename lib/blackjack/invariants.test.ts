import { describe, expect, it } from "vitest";
import { analyze } from "./analyze";
import { CARD_LABELS } from "./cards";
import { INFINITE, SHOE, hand, ok } from "./testing";
import type { ActionKind, CardLabel, DeckMode } from "./types";

const ACTIONS: ActionKind[] = ["stand", "hit", "double", "split"];

/** Deterministic pseudo-random so failures reproduce. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function randomStates(count: number) {
  const rng = makeRng(20260910);
  const decks: DeckMode[] = [SHOE(1), SHOE(2), SHOE(4), SHOE(6), SHOE(8), INFINITE];
  const states = [];
  for (let i = 0; i < count; i++) {
    const deck = decks[Math.floor(rng() * decks.length)];
    const pick = () => CARD_LABELS[Math.floor(rng() * CARD_LABELS.length)] as CardLabel;
    const nPlayer = 1 + Math.floor(rng() * 4);
    const nDealer = 1 + Math.floor(rng() * 2);
    const nSeen = Math.floor(rng() * 6);
    states.push({
      deck,
      playerCards: hand(...Array.from({ length: nPlayer }, pick)),
      dealerCards: hand(...Array.from({ length: nDealer }, pick)),
      removedCards: hand(...Array.from({ length: nSeen }, pick)),
    });
  }
  return states;
}

describe("invariants over randomized states", () => {
  const states = randomStates(400);

  it("never throws and never produces NaN", () => {
    for (const s of states) {
      const res = analyze(s);
      if (res.status !== "ok") continue;
      const nums = [
        res.pDealerBlackjack,
        res.dealer.outcomes.pBust,
        res.outcomes.stand.ev,
        ...ACTIONS.flatMap((a) => [res.actions[a].ev ?? 0, res.actions[a].unconditionalEV ?? 0]),
      ];
      for (const n of nums) expect(Number.isFinite(n)).toBe(true);
    }
  });

  it("dealer distributions sum to 1", () => {
    for (const s of states) {
      const res = analyze(s);
      if (res.status !== "ok") continue;
      const o = res.dealer.outcomes;
      const sum = o.p17 + o.p18 + o.p19 + o.p20 + o.p21 + o.pBust;
      expect(sum).toBeCloseTo(1, 9);
    }
  });

  it("win + push + loss = 1 for every available action", () => {
    for (const s of states) {
      const res = analyze(s);
      if (res.status !== "ok") continue;
      for (const a of ACTIONS) {
        const o = res.actions[a].outcome;
        if (!o) continue;
        expect(o.win + o.push + o.loss, `${a}`).toBeCloseTo(1, 9);
      }
    }
  });

  it("keeps every EV inside its theoretical bounds", () => {
    for (const s of states) {
      const res = analyze(s);
      if (res.status !== "ok") continue;
      const bound: Record<ActionKind, number> = { stand: 1, hit: 1, double: 2, split: 4 };
      for (const a of ACTIONS) {
        const ev = res.actions[a].ev;
        if (ev === null) continue;
        // Player naturals pay 3:2, so standing can reach 1.5.
        const limit = a === "stand" ? 1.5 : bound[a];
        expect(ev, `${a} ev=${ev}`).toBeGreaterThanOrEqual(-limit - 1e-9);
        expect(ev, `${a} ev=${ev}`).toBeLessThanOrEqual(limit + 1e-9);
      }
    }
  });

  /**
   * Hitting and then continuing to play optimally must dominate drawing exactly one
   * card and stopping, which is what a double does for half the money.
   *
   * This is the most valuable invariant in the suite: it catches sign errors, bet
   * scaling errors, and any mismatch between the dealer distribution used by the hit
   * path and the one used by the double path, all at once.
   */
  it("hitEV >= doubleEV / 2 always", () => {
    for (const s of states) {
      const res = analyze(s);
      if (res.status !== "ok") continue;
      const hit = res.actions.hit.ev;
      const dbl = res.actions.double.ev;
      if (hit === null || dbl === null) continue;
      expect(hit + 1e-9, `hit=${hit} double=${dbl}`).toBeGreaterThanOrEqual(dbl / 2);
    }
  });

  /**
   * Only valid at a FIXED dealer distribution, so this uses an infinite deck.
   * In a real shoe it is genuinely false: building 15 as 10,5 and 16 as 10,6 removes
   * different cards, which shifts the dealer's bust chance by more than the (zero)
   * gap between standing on 15 and standing on 16 against a dealer who stands on 17+.
   * That composition dependence is correct engine behaviour, not a bug.
   */
  it("stand EV is non-decreasing in the player total", () => {
    for (const up of ["2", "6", "7", "10", "A"] as CardLabel[]) {
      let prev = -Infinity;
      for (const total of [12, 13, 14, 15, 16, 17, 18, 19, 20]) {
        const res = analyze({
          deck: INFINITE,
          dealerCards: hand(up),
          playerCards: hand("10", String(total - 10) as CardLabel),
        });
        if (res.status !== "ok") continue;
        const ev = res.outcomes.stand.ev;
        expect(ev + 1e-9, `${total} vs ${up}`).toBeGreaterThanOrEqual(prev);
        prev = ev;
      }
    }
  });
});

describe("fast vs exact precision", () => {
  const spots: Array<{ player: CardLabel[]; dealer: CardLabel[] }> = [
    { player: ["10", "6"], dealer: ["10"] },
    { player: ["A", "2"], dealer: ["6"] },
    { player: ["A", "A"], dealer: ["A"] },
    { player: ["7", "8"], dealer: ["7"] },
    { player: ["2", "2"], dealer: ["2"] },
    { player: ["6", "5"], dealer: ["10"] },
  ];

  // Worst measured deviation is 1.4e-5, on 2,2 vs 2 - a hand that draws deeply.
  it("agrees to 5e-5 at 4+ decks", () => {
    for (const deck of [SHOE(4), SHOE(6), SHOE(8)]) {
      for (const s of spots) {
        const fast = ok({ ...s, deck, precision: "fast" });
        const exact = ok({ ...s, deck, precision: "exact" });
        for (const a of ACTIONS) {
          const f = fast.actions[a].ev;
          const e = exact.actions[a].ev;
          if (f === null || e === null) continue;
          expect(Math.abs(f - e), `${a} ${s.player} vs ${s.dealer}`).toBeLessThan(5e-5);
        }
      }
    }
  });

  // Worst measured deviation is 7.0e-4, on splitting 2,2 vs 2 in a single deck.
  // Still an order of magnitude below the third decimal the UI displays.
  it("agrees to 2e-3 at 1-2 decks, where removal effects are strongest", () => {
    for (const deck of [SHOE(1), SHOE(2)]) {
      for (const s of spots) {
        const fast = ok({ ...s, deck, precision: "fast" });
        const exact = ok({ ...s, deck, precision: "exact" });
        for (const a of ACTIONS) {
          const f = fast.actions[a].ev;
          const e = exact.actions[a].ev;
          if (f === null || e === null) continue;
          expect(Math.abs(f - e), `${a} ${s.player} vs ${s.dealer}`).toBeLessThan(2e-3);
        }
      }
    }
  });

  /**
   * The first-order correction is exact for a single removed card, and a double draws
   * exactly one card - so doubling carries no approximation error at all.
   */
  it("is exact for doubling, by construction", () => {
    for (const deck of [SHOE(1), SHOE(2), SHOE(8)]) {
      for (const s of spots) {
        const fast = ok({ ...s, deck, precision: "fast" });
        const exact = ok({ ...s, deck, precision: "exact" });
        const f = fast.actions.double.ev;
        const e = exact.actions.double.ev;
        if (f === null || e === null) continue;
        expect(Math.abs(f - e)).toBeLessThan(1e-12);
      }
    }
  });

  it("is bit-for-bit identical in infinite mode, where there is no removal", () => {
    for (const s of spots) {
      const fast = ok({ ...s, deck: INFINITE, precision: "fast" });
      const exact = ok({ ...s, deck: INFINITE, precision: "exact" });
      for (const a of ACTIONS) {
        expect(fast.actions[a].ev).toBe(exact.actions[a].ev);
      }
    }
  });
});

describe("deck-count convergence", () => {
  /**
   * A very large shoe must approach the infinite-deck answer. This catches
   * removal-bookkeeping bugs that the fixed published tables can miss.
   */
  it("200 decks approaches infinite", () => {
    const spots: Array<{ player: CardLabel[]; dealer: CardLabel[] }> = [
      { player: ["10", "6"], dealer: ["10"] },
      { player: ["A", "7"], dealer: ["9"] },
      { player: ["6", "5"], dealer: ["A"] },
    ];
    for (const s of spots) {
      const big = ok({ ...s, deck: SHOE(200) });
      const inf = ok({ ...s, deck: INFINITE });
      for (const a of ACTIONS) {
        const b = big.actions[a].ev;
        const i = inf.actions[a].ev;
        if (b === null || i === null) continue;
        expect(Math.abs(b - i), `${a}`).toBeLessThan(1e-3);
      }
    }
  });
});

describe("performance budget", () => {
  /**
   * The whole UI design rests on analyze() being cheap enough to run synchronously
   * inside a useMemo on every click. This test is what keeps that decision honest
   * as the engine evolves.
   */
  it("fast mode stays far under 10ms for the worst case", () => {
    // Measured worst case across deck counts and spots: 2,2 vs 2 at ~4.4ms.
    const run = () => ok({ player: ["2", "2"], dealer: ["2"], deck: SHOE(8) });
    run(); // warm up
    const t0 = performance.now();
    const iterations = 20;
    for (let i = 0; i < iterations; i++) run();
    const perCall = (performance.now() - t0) / iterations;
    expect(perCall, `${perCall.toFixed(2)}ms per analyze()`).toBeLessThan(10);
  });
});
