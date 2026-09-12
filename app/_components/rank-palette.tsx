"use client";

import { LABEL_TO_RANK, RANK_NAMES } from "@/lib/blackjack";
import type { CardLabel } from "@/lib/blackjack";
import { CARD_LABELS, TEN_LABELS } from "./palette-data";
import type { TargetHand } from "../_state/types";

export interface RankPaletteProps {
  target: TargetHand;
  remainingByRank: number[];
  infinite: boolean;
  canUndo: boolean;
  /** False when both hands and every discard are already empty. */
  canClear: boolean;
  rulesSummary: string;
  onAddCard: (label: CardLabel) => void;
  onSwitchTarget: (hand: TargetHand) => void;
  onUndo: () => void;
  onReset: () => void;
}

export function RankPalette({
  target,
  remainingByRank,
  infinite,
  canUndo,
  canClear,
  rulesSummary,
  onAddCard,
  onSwitchTarget,
  onUndo,
  onReset,
}: RankPaletteProps) {
  const targetLabel = target === "dealer" ? "the dealer" : "you";

  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-onyx-700 bg-onyx-900/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:static lg:mx-0 lg:rounded-xl lg:border lg:pb-3 lg:backdrop-blur-none">
      {/*
       * Text rank chips rather than card icons: the Game Icons court engravings are
       * indistinguishable dark blobs at 44px, and an "A-spade" key would read as
       * "add the ace of spades" - implying suit selection where none exists.
       */}
      <div
        role="group"
        aria-label="Card rank palette"
        className="grid grid-cols-7 gap-1.5 sm:grid-cols-13 sm:gap-2"
      >
        {CARD_LABELS.map((label) => {
          const rank = LABEL_TO_RANK[label];
          const remaining = remainingByRank[rank];
          const out = !infinite && remaining <= 0;
          return (
            <button
              key={label}
              type="button"
              disabled={out}
              onClick={() => onAddCard(label)}
              aria-label={
                infinite
                  ? `Deal ${RANK_NAMES[label]} to ${targetLabel}`
                  : `Deal ${RANK_NAMES[label]} to ${targetLabel}, ${remaining} remaining in shoe`
              }
              className={[
                "group flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border sm:h-14",
                "font-mono text-lg font-semibold tabular-nums transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400",
                out
                  ? "cursor-not-allowed border-onyx-800 bg-onyx-950/60 text-ink-500"
                  : "border-onyx-700 bg-onyx-800 text-ink-100 hover:border-gold-400 hover:bg-onyx-700 active:scale-[0.97]",
              ].join(" ")}
            >
              <span className="leading-none">{label}</span>
              {/* The remaining count is the only place the shoe becomes tactile, and
                  disabling at zero prevents entering an impossible hand. */}
              <span
                className={`font-sans text-[10px] font-normal leading-none ${
                  out ? "text-loss-300" : "text-ink-500"
                }`}
              >
                {infinite ? "∞" : remaining}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-sans text-[11px] uppercase tracking-wider text-ink-500">
          Dealing to
        </span>

        <div className="inline-flex overflow-hidden rounded-lg border border-onyx-700">
          {(["dealer", "player"] as TargetHand[]).map((hand) => (
            <button
              key={hand}
              type="button"
              onClick={() => onSwitchTarget(hand)}
              aria-pressed={target === hand}
              className={[
                "px-3 py-1.5 font-sans text-xs font-semibold uppercase tracking-wider transition-colors",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold-400",
                target === hand
                  ? "bg-gold-400 text-onyx-950"
                  : "bg-onyx-800 text-ink-300 hover:text-ink-100",
              ].join(" ")}
            >
              {hand}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="rounded-lg border border-onyx-700 bg-onyx-800 px-3 py-1.5 font-sans text-xs text-ink-300 transition-colors hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
        >
          Undo
        </button>

        {/*
         * Bordered and destructive-tinted rather than a quiet text link. It was the
         * latter, and was routinely missed - "how do I start the next hand" is the
         * first thing anyone asks of a tool like this, so the answer has to look like
         * a button. Disabled when there is nothing to clear, which also makes the
         * empty state self-evident.
         */}
        <button
          type="button"
          onClick={onReset}
          disabled={!canClear}
          title="Clear both hands and every discard (R). Keeps the deck count; Ctrl+Z undoes it."
          aria-label="Clear all: both hands and every discard"
          className="rounded-lg border border-onyx-700 bg-onyx-800 px-3 py-1.5 font-sans text-xs text-ink-300 transition-colors hover:border-loss-400/60 hover:text-loss-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-onyx-700 disabled:hover:text-ink-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
        >
          Clear all
        </button>

        <span className="ml-auto hidden font-mono text-[10px] text-ink-500 sm:inline">
          {rulesSummary}
        </span>
      </div>

      <p className="mt-2 font-sans text-[10px] leading-snug text-ink-500">
        Keys: A, 2&ndash;9, 0 or T, J, Q, K deal &middot; Tab or D / P switch hand &middot;
        Backspace undeals &middot; R clears all &middot; Ctrl+Z undoes.
        {!infinite ? (
          <>
            {" "}
            {TEN_LABELS.join(", ")} share one pool of{" "}
            {remainingByRank[LABEL_TO_RANK.K]} ten-value cards.
          </>
        ) : null}
      </p>
    </div>
  );
}
