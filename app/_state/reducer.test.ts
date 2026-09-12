import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/blackjack";
import type { CardLabel } from "@/lib/blackjack";
import {
  createInitialState,
  discardCards,
  reducer,
  remainingByRank,
  totalRemaining,
} from "./reducer";
import { toDeckMode } from "./types";
import type { CalculatorAction, CalculatorHistory } from "./types";

function run(actions: CalculatorAction[], start?: CalculatorHistory): CalculatorHistory {
  return actions.reduce(reducer, start ?? createInitialState());
}

const deal = (label: CardLabel): CalculatorAction => ({ type: "addCard", label });

/** The engine call the UI actually makes, so these exercise the real wiring. */
function look(state: CalculatorHistory) {
  return analyze({
    deck: toDeckMode(state.decks),
    dealerCards: state.dealer,
    playerCards: state.player,
    removedCards: discardCards(state),
  });
}

describe("dealing", () => {
  it("starts on 8 decks with a full shoe and empty hands", () => {
    const s = createInitialState();
    expect(s.decks).toBe(8);
    expect(totalRemaining(s)).toBe(416);
    expect(remainingByRank(s)[9]).toBe(128);
    expect(s.target).toBe("dealer");
  });

  it("deals to the active hand and switches target", () => {
    const s = run([
      deal("A"),
      { type: "setTarget", hand: "player" },
      deal("8"),
      deal("8"),
    ]);
    expect(s.dealer.map((c) => c.label)).toEqual(["A"]);
    expect(s.player.map((c) => c.label)).toEqual(["8", "8"]);
  });

  it("cycles suits deterministically and freezes them per card", () => {
    const s = run([deal("A"), deal("2"), deal("3"), deal("4"), deal("5")]);
    expect(s.dealer.map((c) => c.suit)).toEqual(["S", "H", "D", "C", "S"]);

    // Removing the first card must not re-suit the rest.
    const after = reducer(s, { type: "removeCard", hand: "dealer", uid: s.dealer[0].uid });
    expect(after.dealer.map((c) => c.suit)).toEqual(["H", "D", "C", "S"]);
  });

  it("honours an explicitly picked suit from the exact-card popover", () => {
    const s = run([{ type: "addCard", label: "Q", suit: "D" }]);
    expect(s.dealer[0].suit).toBe("D");
    expect(s.dealer[0].rank).toBe(9);
  });

  it("uses deterministic ids so prerender and hydration agree", () => {
    const a = run([deal("A"), deal("K")]);
    const b = run([deal("A"), deal("K")]);
    expect(a.dealer.map((c) => c.uid)).toEqual(b.dealer.map((c) => c.uid));
  });

  it("refuses a card the shoe no longer holds", () => {
    // Four aces exhaust a single deck.
    let s = run([{ type: "setDecks", decks: 1 }, deal("A"), deal("A"), deal("A"), deal("A")]);
    expect(remainingByRank(s)[0]).toBe(0);
    const before = s.dealer.length;
    s = reducer(s, deal("A"));
    expect(s.dealer.length).toBe(before);
  });

  it("never refuses a card in infinite mode", () => {
    let s = run([{ type: "setDecks", decks: "infinite" }]);
    for (let i = 0; i < 6; i++) s = reducer(s, deal("A"));
    expect(s.dealer.length).toBe(6);
  });
});

describe("deck changes stay legal", () => {
  it("trims hands that a smaller shoe cannot contain", () => {
    // Six aces is fine at 8 decks, impossible at one.
    let s = run([deal("A"), deal("A"), deal("A"), deal("A"), deal("A"), deal("A")]);
    expect(s.dealer.length).toBe(6);
    s = reducer(s, { type: "setDecks", decks: 1 });
    expect(s.dealer.length).toBe(4);
    expect(look(s).status).not.toBe("invalid");
  });

  it("clamps discards when the shoe shrinks", () => {
    let s = run([{ type: "setDiscard", rank: 0, count: 20 }]);
    expect(s.discards[0]).toBe(20);
    s = reducer(s, { type: "setDecks", decks: 1 });
    expect(s.discards[0]).toBeLessThanOrEqual(4);
  });
});

describe("discard tracker", () => {
  it("clamps to what the shoe holds minus cards on the table", () => {
    let s = run([{ type: "setDecks", decks: 1 }, deal("7"), deal("7")]);
    s = reducer(s, { type: "setDiscard", rank: 6, count: 99 });
    // Two sevens are on the table, so at most two more can have been seen.
    expect(s.discards[6]).toBe(2);
    expect(remainingByRank(s)[6]).toBe(0);
  });

  it("is inert in infinite mode", () => {
    const s = run([{ type: "setDecks", decks: "infinite" }, { type: "adjustDiscard", rank: 0, delta: 3 }]);
    expect(s.discards[0]).toBe(0);
  });

  it("feeds removals through to the engine", () => {
    const base = run([deal("6"), { type: "setTarget", hand: "player" }, deal("10"), deal("6")]);
    const withDiscards = reducer(base, { type: "setDiscard", rank: 9, count: 40 });

    const a = look(base);
    const b = look(withDiscards);
    if (a.status !== "ok" || b.status !== "ok") throw new Error("expected ok");

    expect(discardCards(withDiscards)).toHaveLength(40);
    expect(b.shoe.remaining).toBe(a.shoe.remaining - 40);
    // Stripping forty ten-value cards materially changes the dealer's bust chance.
    expect(b.dealer.outcomes.pBust).not.toBeCloseTo(a.dealer.outcomes.pBust, 4);
  });
});

describe("undo", () => {
  it("reverses a misdealt card", () => {
    let s = run([deal("9")]);
    s = reducer(s, deal("8")); // the fat-finger
    expect(s.dealer.map((c) => c.label)).toEqual(["9", "8"]);
    s = reducer(s, { type: "undo" });
    expect(s.dealer.map((c) => c.label)).toEqual(["9"]);
  });

  it("does nothing with no history", () => {
    const s = createInitialState();
    expect(reducer(s, { type: "undo" })).toBe(s);
  });

  it("does not record target switches, which change no numbers", () => {
    const s = run([deal("9"), { type: "setTarget", hand: "player" }]);
    const undone = reducer(s, { type: "undo" });
    expect(undone.dealer).toHaveLength(0);
  });

  it("reverses a deck change including its clamping", () => {
    let s = run([deal("A"), deal("A"), deal("A"), deal("A"), deal("A")]);
    s = reducer(s, { type: "setDecks", decks: 1 });
    expect(s.dealer).toHaveLength(4);
    s = reducer(s, { type: "undo" });
    expect(s.decks).toBe(8);
    expect(s.dealer).toHaveLength(5);
  });
});

describe("end-to-end scenarios the UI must handle", () => {
  it("recommends splitting eights against an ace and surfaces the blackjack risk", () => {
    const s = run([
      deal("A"),
      { type: "setTarget", hand: "player" },
      deal("8"),
      deal("8"),
    ]);
    const res = look(s);
    if (res.status !== "ok") throw new Error(res.status);
    expect(res.bestAction).toBe("split");
    expect(res.pDealerBlackjack).toBeGreaterThan(0.3);
    expect(res.actions.split.note).toMatch(/no resplit/);
  });

  it("reports incomplete with nothing dealt", () => {
    expect(look(createInitialState()).status).toBe("incomplete");
  });

  it("warns rather than inventing numbers for a bust hand", () => {
    const s = run([
      deal("6"),
      { type: "setTarget", hand: "player" },
      deal("10"),
      deal("9"),
      deal("5"),
    ]);
    const res = look(s);
    if (res.status !== "ok") throw new Error(res.status);
    expect(res.resolution).toBe("playerBust");
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.actions.hit.available).toBe(false);
  });

  it("moves the numbers when switching to an infinite shoe", () => {
    const finite = run([deal("6"), { type: "setTarget", hand: "player" }, deal("10"), deal("6")]);
    const infinite = reducer(finite, { type: "setDecks", decks: "infinite" });

    const a = look(finite);
    const b = look(infinite);
    if (a.status !== "ok" || b.status !== "ok") throw new Error("expected ok");

    expect(b.shoe.infinite).toBe(true);
    // Counting readouts are meaningless with replacement; the UI renders these as "-".
    expect(b.shoe.trueCount).toBe(0);
    expect(b.shoe.decks).toBeNull();
    expect(a.shoe.infinite).toBe(false);
  });

  it("clears one hand without disturbing the other", () => {
    let s = run([deal("A"), { type: "setTarget", hand: "player" }, deal("10"), deal("6")]);
    s = reducer(s, { type: "clearHand", hand: "player" });
    expect(s.player).toHaveLength(0);
    expect(s.dealer).toHaveLength(1);
  });
  it("keeps the deck setting across a clear all", () => {
    let s = run([{ type: "setDecks", decks: 2 }, deal("A"), deal("K")]);
    s = reducer(s, { type: "reset" });
    expect(s.decks).toBe(2);
    expect(s.dealer).toHaveLength(0);
  });

  it("clear all empties both hands, every discard and the target", () => {
    let s = run([
      deal("A"),
      { type: "setTarget", hand: "player" },
      deal("10"),
      { type: "adjustDiscard", rank: 9, delta: 3 },
    ]);
    s = reducer(s, { type: "reset" });
    expect(s.dealer).toHaveLength(0);
    expect(s.player).toHaveLength(0);
    expect(s.discards.every((n) => n === 0)).toBe(true);
    expect(s.target).toBe("dealer");
  });

  it("clear all is undoable in one step", () => {
    let s = run([deal("A"), deal("K"), { type: "adjustDiscard", rank: 0, delta: 2 }]);
    s = reducer(s, { type: "reset" });
    s = reducer(s, { type: "undo" });
    expect(s.dealer).toHaveLength(2);
    expect(s.discards[0]).toBe(2);
  });

  it("clear all is a no-op on an already empty table", () => {
    // The button is disabled in this state; the guard keeps a stray dispatch from
    // pushing an undo entry that restores an identical state.
    const s = createInitialState();
    expect(reducer(s, { type: "reset" })).toBe(s);
    expect(reducer(s, { type: "reset" }).past).toHaveLength(0);
  });

  it("clear all still fires when only the deal target has moved", () => {
    const s = reducer(createInitialState(), { type: "setTarget", hand: "player" });
    expect(reducer(s, { type: "reset" }).target).toBe("dealer");
  });
});
