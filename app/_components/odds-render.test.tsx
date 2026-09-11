import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { analyze, cardFromLabel } from "@/lib/blackjack";
import type { AnalysisResult, Card, CardLabel } from "@/lib/blackjack";
import { DealerOdds } from "./dealer-odds";
import { PlayerOdds } from "./player-odds";
import { pct } from "./format";

let uid = 0;
const h = (...labels: CardLabel[]): Card[] =>
  labels.map((l) => cardFromLabel(l, uid++, "S"));

function okResult(dealer: CardLabel[], player: CardLabel[], decks = 8): Extract<AnalysisResult, { status: "ok" }> {
  const res = analyze({
    deck: { kind: "shoe", decks },
    dealerCards: h(...dealer),
    playerCards: h(...player),
  });
  if (res.status !== "ok") throw new Error(res.status);
  return res;
}

/** Renders the odds columns from real engine output, so the numbers on screen are checked. */
describe("dealer odds column", () => {
  /**
   * Asserts the RENDER, not the maths - dealer.test.ts already pins the distribution
   * against the published tables. Note the player's 10,6 removes cards from the shoe,
   * so these values legitimately differ from a bare-upcard table row.
   */
  it("renders the engine's bust percentage and the S17 signature", () => {
    const res = okResult(["6"], ["10", "6"]);
    const o = res.dealer.outcomes;
    const html = renderToStaticMarkup(
      <DealerOdds outcomes={o} upcard={res.dealer.upcard} dealerCardCount={1} />,
    );
    expect(html).toContain(pct(o.pBust));
    expect(pct(o.pBust)).toMatch(/^42\./);
    // S17 signature: standing on soft 17 lifts the 17 row well above the others.
    expect(html).toContain(pct(o.p17));
    expect(o.p17).toBeGreaterThan(o.p18 * 1.4);
    expect(html).toContain("from showing 6");
    expect(html).toContain("good for you");
  });

  it("surfaces dealer blackjack as its own figure, not a bar", () => {
    const res = okResult(["A"], ["10", "6"]);
    const html = renderToStaticMarkup(
      <DealerOdds outcomes={res.dealer.outcomes} upcard={res.dealer.upcard} dealerCardCount={1} />,
    );
    expect(html).toContain("P(blackjack)");
    expect(html).toContain("assume no dealer blackjack");
  });

  it("says it used the whole hand once both dealer cards are known", () => {
    const res = okResult(["A", "6"], ["10", "6"]);
    const html = renderToStaticMarkup(
      <DealerOdds outcomes={res.dealer.outcomes} upcard={res.dealer.upcard} dealerCardCount={2} />,
    );
    expect(html).toContain("from the full hand");
    // A,6 is soft 17 and the dealer stands on it.
    expect(html).toContain("100.0%");
    expect(html).not.toContain("P(blackjack)");
  });

  it("prompts for a card when the dealer has none", () => {
    const html = renderToStaticMarkup(
      <DealerOdds outcomes={null} upcard={null} dealerCardCount={0} />,
    );
    expect(html).toContain("Deal the dealer a card");
  });
});

describe("player odds column", () => {
  it("labels win/push/loss as standing, and shows the best action separately", () => {
    // 16 vs 10: hitting is best, so a bare "Loss 77%" would look self-contradictory.
    const res = okResult(["10"], ["10", "6"]);
    const html = renderToStaticMarkup(
      <PlayerOdds
        stand={res.outcomes.stand}
        best={res.outcomes.best}
        bestAction={res.bestAction}
        actions={res.actions}
        splitNote={res.actions.split.note}
      />,
    );
    expect(res.bestAction).toBe("hit");
    expect(html).toContain("If you stand");
    expect(html).toContain("If you hit");
    expect(html).toContain("(best)");
    expect(html).toContain("Best");
  });

  it("renders unavailable actions as a dash with a reason, keeping four rows", () => {
    const res = okResult(["10"], ["10", "6"]);
    const html = renderToStaticMarkup(
      <PlayerOdds
        stand={res.outcomes.stand}
        best={res.outcomes.best}
        bestAction={res.bestAction}
        actions={res.actions}
      />,
    );
    expect(html).toContain("needs pair");
    expect(html).toContain("—");
    for (const name of ["Stand", "Hit", "Double", "Split"]) {
      expect(html, name).toContain(name);
    }
  });

  it("notes the split model when splitting is recommended", () => {
    const res = okResult(["10"], ["8", "8"]);
    expect(res.bestAction).toBe("split");
    const html = renderToStaticMarkup(
      <PlayerOdds
        stand={res.outcomes.stand}
        best={res.outcomes.best}
        bestAction={res.bestAction}
        actions={res.actions}
        splitNote={res.actions.split.note}
      />,
    );
    expect(html).toContain("no resplit");
    expect(html).toContain("per hand");
  });

  it("formats EV with a real minus sign so the column does not shift", () => {
    const res = okResult(["10"], ["10", "6"]);
    const html = renderToStaticMarkup(
      <PlayerOdds
        stand={res.outcomes.stand}
        best={res.outcomes.best}
        bestAction={res.bestAction}
        actions={res.actions}
      />,
    );
    expect(html).toContain("\u22120.5");
    expect(html).not.toMatch(/>-0\.\d/);
  });
});
