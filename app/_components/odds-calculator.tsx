"use client";

import { useEffect, useMemo, useReducer } from "react";
import { RULES_SUMMARY, analyze, preDealBaseline, rankLabel } from "@/lib/blackjack";
import type {
  ActionEV,
  ActionKind,
  AnalysisResult,
  CardLabel,
  DealerInfo,
  HandValue,
  Outcome,
  ShoeInfo,
} from "@/lib/blackjack";
import { DealerOdds } from "./dealer-odds";
import { DiscardTracker } from "./discard-tracker";
import { HandPanel } from "./hand-panel";
import { LiveAnnouncer } from "./live-announcer";
import { PlayerOdds } from "./player-odds";
import { RankPalette } from "./rank-palette";
import { ShoePanel } from "./shoe-panel";
import { KEY_TO_LABEL } from "./palette-data";
import {
  createInitialState,
  discardCards,
  reducer,
  remainingByRank,
} from "../_state/reducer";
import { toDeckMode, type DeckOption, type TargetHand } from "../_state/types";

interface View {
  shoe: ShoeInfo | null;
  player: HandValue | null;
  dealer: DealerInfo | null;
  actions: Record<ActionKind, ActionEV> | null;
  stand: Outcome | null;
  best: Outcome | null;
  bestAction: ActionKind | null;
  warnings: string[];
  invalidReason: string | null;
  approximations: string[];
  splitNote: string | undefined;
}

/** Flatten the engine's discriminated union into one shape the panels can render. */
function toView(res: AnalysisResult): View {
  const empty: View = {
    shoe: null,
    player: null,
    dealer: null,
    actions: null,
    stand: null,
    best: null,
    bestAction: null,
    warnings: [],
    invalidReason: null,
    approximations: [],
    splitNote: undefined,
  };

  if (res.status === "invalid") {
    return { ...empty, invalidReason: res.reason };
  }
  if (res.status === "incomplete") {
    return { ...empty, shoe: res.shoe, player: res.player, dealer: res.dealer };
  }
  return {
    shoe: res.shoe,
    player: res.player,
    dealer: res.dealer,
    actions: res.actions,
    stand: res.outcomes.stand,
    best: res.outcomes.best,
    bestAction: res.bestAction,
    warnings: [...res.warnings],
    invalidReason: null,
    approximations: [...res.meta.approximations],
    splitNote: res.actions.split.note,
  };
}

function composeSummary(view: View, target: TargetHand): string {
  if (view.invalidReason) return view.invalidReason;

  // Always leads with the target. Tab changes nothing else on screen once both hands
  // are dealt, so without this a screen-reader user gets silence when they press it.
  const lead = `Dealing to ${target}.`;

  if (!view.player || !view.dealer || !view.actions || !view.stand) {
    const d = view.dealer?.outcomes;
    const prior =
      d && view.dealer?.value.cardCount === 0
        ? ` Before the deal the dealer busts ${Math.round(d.pBust * 100)} percent of the time` +
          ` and has blackjack ${(d.pNatural * 100).toFixed(1)} percent.`
        : "";
    return `${lead}${prior} Deal both hands to see the odds.`;
  }

  const p = view.player;
  const playerPart = p.isBust
    ? `You are bust with ${p.total}.`
    : p.isNatural
      ? "You have blackjack."
      : `You have ${p.total} ${p.isSoft ? "soft" : "hard"}.`;

  const upcard =
    view.dealer.value.cardCount === 1 && view.dealer.upcard !== null
      ? `Dealer shows ${rankLabel(view.dealer.upcard)}.`
      : `Dealer has ${view.dealer.value.total}.`;

  const s = view.stand;
  const standPart = `Standing wins ${Math.round(s.win * 100)} percent, pushes ${Math.round(
    s.push * 100,
  )}, loses ${Math.round(s.loss * 100)}.`;

  const b = view.bestAction;
  const bestPart =
    b && view.actions[b].ev !== null
      ? ` Best action: ${b}, expected value ${
          view.actions[b].ev! < 0 ? "minus" : "plus"
        } ${Math.abs(view.actions[b].ev!).toFixed(2)}.`
      : "";

  return `${playerPart} ${upcard} ${standPart}${bestPart}`;
}

export function OddsCalculator() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  const remaining = useMemo(() => remainingByRank(state), [state]);

  /**
   * Synchronous on purpose. Measured worst case for the engine's default precision is
   * ~4.4ms (2,2 vs 2 at 8 decks) against a 50ms budget, so there is no need for a web
   * worker, a debounce, or startTransition - and a guard test keeps that true.
   */
  const view = useMemo(() => {
    const res = analyze({
      deck: toDeckMode(state.decks),
      dealerCards: state.dealer,
      playerCards: state.player,
      removedCards: discardCards(state),
    });
    return toView(res);
  }, [state]);

  const summary = useMemo(() => composeSummary(view, state.target), [view, state.target]);

  // Typeahead. Guarded so typing into the discard fields never deals a card.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement;
      // The exact-card popover is a 52-button grid; Tab has to keep its normal meaning
      // inside it or the grid becomes unreachable by keyboard.
      const inPopover =
        el instanceof Element && el.closest('[data-slot="popover-content"]') !== null;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: "undo" });
        return;
      }

      /**
       * Tab and Shift+Tab both flip the hand being dealt to - the highest-frequency
       * action in this UI, on the key that already means "switch pane" everywhere
       * else. With two hands there is no forward or backward, so both directions do
       * the same thing.
       *
       * This takes focus navigation away from the page entirely. Deliberate, and the
       * reason the two guards above exist: inside the discard fields and inside the
       * exact-card popover Tab keeps its normal meaning, which is what keeps those
       * controls reachable. Everything else is driven by mouse or by the hotkeys.
       */
      if (e.key === "Tab" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        if (typing || inPopover) return;
        e.preventDefault();
        dispatch({
          type: "setTarget",
          hand: state.target === "dealer" ? "player" : "dealer",
        });
        return;
      }

      if (e.altKey || e.ctrlKey || e.metaKey || typing) return;

      const key = e.key.toLowerCase();
      if (key === "d" || key === "p") {
        e.preventDefault();
        dispatch({ type: "setTarget", hand: key === "d" ? "dealer" : "player" });
        return;
      }
      // Destructive on a single unmodified keypress, which is only acceptable because
      // it lands in the undo stack like everything else - Ctrl+Z brings the table back.
      if (key === "r") {
        e.preventDefault();
        dispatch({ type: "reset" });
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        const hand = state[state.target];
        const last = hand[hand.length - 1];
        if (last) dispatch({ type: "removeCard", hand: state.target, uid: last.uid });
        return;
      }
      const label = KEY_TO_LABEL[key];
      if (label) {
        e.preventDefault();
        dispatch({ type: "addCard", label });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state]);

  const inHands = state.dealer.length + state.player.length;
  // Mirrors the reducer's own no-op guard, so the button is never live-but-inert.
  const canClear =
    inHands > 0 || state.discards.some((n) => n > 0) || state.target !== "dealer";
  const dealerWarnings = view.warnings.filter((w) => w.toLowerCase().includes("dealer"));
  const playerWarnings = view.warnings.filter((w) => !w.toLowerCase().includes("dealer"));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-6">
      <h1 className="sr-only">Blackjack odds calculator</h1>
      <LiveAnnouncer message={summary} />

      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4">
        <p className="font-sans text-lg font-semibold tracking-tight text-ink-100">
          <span aria-hidden="true" className="text-gold-400">
            &spades;
          </span>{" "}
          Blackjack Odds
        </p>
        <ShoePanel
          decks={state.decks}
          shoe={view.shoe}
          onSetDecks={(decks: DeckOption) => dispatch({ type: "setDecks", decks })}
        />
      </header>

      {view.invalidReason ? (
        <p className="mb-4 rounded-lg border border-loss-400/40 bg-loss-400/10 px-3 py-2 font-sans text-xs text-loss-300">
          {view.invalidReason}
        </p>
      ) : null}

      <div className="space-y-4">
        <HandPanel
          hand="dealer"
          label="Dealer"
          cards={state.dealer}
          value={view.dealer?.value ?? null}
          isActive={state.target === "dealer"}
          markUpcard
          oddsMinHeight="21rem"
          remainingByRank={remaining}
          infinite={state.decks === "infinite"}
          onPickExact={(label, suit) => dispatch({ type: "addCard", label, suit })}
          warnings={dealerWarnings}
          onActivate={() => dispatch({ type: "setTarget", hand: "dealer" })}
          onRemoveCard={(uid) => dispatch({ type: "removeCard", hand: "dealer", uid })}
          onClear={() => dispatch({ type: "clearHand", hand: "dealer" })}
        >
          <DealerOdds
            outcomes={view.dealer?.outcomes ?? null}
            upcard={view.dealer?.upcard ?? null}
            dealerCardCount={state.dealer.length}
          />
        </HandPanel>

        <HandPanel
          hand="player"
          label="Player"
          cards={state.player}
          value={view.player}
          isActive={state.target === "player"}
          oddsMinHeight="29rem"
          remainingByRank={remaining}
          infinite={state.decks === "infinite"}
          onPickExact={(label, suit) => dispatch({ type: "addCard", label, suit })}
          warnings={playerWarnings}
          footnote="Suits are cosmetic — 10, J, Q and K count identically and suit is ignored."
          onActivate={() => dispatch({ type: "setTarget", hand: "player" })}
          onRemoveCard={(uid) => dispatch({ type: "removeCard", hand: "player", uid })}
          onClear={() => dispatch({ type: "clearHand", hand: "player" })}
        >
          <PlayerOdds
            stand={view.stand}
            best={view.best}
            bestAction={view.bestAction}
            actions={view.actions}
            splitNote={view.splitNote}
            baseline={preDealBaseline(state.decks)}
            shoeDisturbed={state.discards.some((n) => n > 0)}
          />
        </HandPanel>

        <RankPalette
          target={state.target}
          remainingByRank={remaining}
          infinite={state.decks === "infinite"}
          canUndo={state.past.length > 0}
          canClear={canClear}
          rulesSummary={RULES_SUMMARY}
          onAddCard={(label: CardLabel) => dispatch({ type: "addCard", label })}
          onSwitchTarget={(hand) => dispatch({ type: "setTarget", hand })}
          onUndo={() => dispatch({ type: "undo" })}
          onReset={() => dispatch({ type: "reset" })}
        />

        <DiscardTracker
          decks={state.decks}
          discards={state.discards}
          remainingByRank={remaining}
          inHands={inHands}
          onAdjust={(rank, delta) => dispatch({ type: "adjustDiscard", rank, delta })}
          onSet={(rank, count) => dispatch({ type: "setDiscard", rank, count })}
          onClear={() => dispatch({ type: "clearDiscards" })}
        />

        <footer className="space-y-1 pb-2">
          <p className="font-sans text-[11px] text-ink-500">
            Rules assumed: {RULES_SUMMARY}. Expected value is in units of your initial
            bet and assumes the dealer has already peeked for blackjack.
          </p>
          {view.approximations.length > 0 ? (
            <ul className="space-y-0.5">
              {view.approximations.map((a) => (
                <li key={a} className="font-sans text-[10px] leading-snug text-ink-500">
                  {a}
                </li>
              ))}
            </ul>
          ) : null}
        </footer>
      </div>
    </main>
  );
}
