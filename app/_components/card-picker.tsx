"use client";

import { LABEL_TO_RANK, RANK_NAMES, SUITS, SUIT_GLYPH, SUIT_IS_RED } from "@/lib/blackjack";
import type { CardLabel, Suit } from "@/lib/blackjack";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CardIcon } from "./card-icon";
import { CARD_LABELS } from "./palette-data";

export interface CardPickerProps {
  targetLabel: string;
  remainingByRank: number[];
  infinite: boolean;
  onPick: (label: CardLabel, suit: Suit) => void;
}

/**
 * Exact-card picker in a popover.
 *
 * Deliberately stays open after a pick: this is a tool the user clicks many times in a
 * row, so closing on every selection would double the interaction cost of entering a
 * hand. The quick rank strip beside it remains the fast path for when the suit does not
 * matter - which, mathematically, is always.
 */
export function CardPicker({
  targetLabel,
  remainingByRank,
  infinite,
  onPick,
}: CardPickerProps) {
  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-felt-700 bg-felt-800 px-3 font-sans text-xs font-medium text-ink-300 transition-colors hover:border-brass-400 hover:text-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-400"
        aria-label="Pick an exact card, including its suit"
      >
        <span aria-hidden="true">&#43;</span> Exact card
      </PopoverTrigger>

      <PopoverContent
        className="w-auto max-w-[min(94vw,34rem)] gap-3 border border-felt-700 bg-felt-900 p-3"
        align="end"
      >
        <div>
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300">
            Deal to {targetLabel}
          </p>
          <p className="mt-0.5 font-sans text-[10px] leading-snug text-ink-500">
            Suit is cosmetic. Tens, jacks, queens and kings share one pool, so they
            disable together.
          </p>
        </div>

        <div className="overflow-x-auto">
          <div className="grid grid-cols-[auto_repeat(13,minmax(0,1fr))] gap-1">
            <span aria-hidden="true" />
            {CARD_LABELS.map((label) => (
              <span
                key={label}
                aria-hidden="true"
                className="pb-0.5 text-center font-mono text-[10px] text-ink-500"
              >
                {label}
              </span>
            ))}

            {SUITS.map((suit) => (
              <PickerRow
                key={suit}
                suit={suit}
                remainingByRank={remainingByRank}
                infinite={infinite}
                targetLabel={targetLabel}
                onPick={onPick}
              />
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PickerRow({
  suit,
  remainingByRank,
  infinite,
  targetLabel,
  onPick,
}: {
  suit: Suit;
  remainingByRank: number[];
  infinite: boolean;
  targetLabel: string;
  onPick: (label: CardLabel, suit: Suit) => void;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className={`flex items-center pr-1 font-mono text-sm ${
          SUIT_IS_RED[suit] ? "text-loss-400" : "text-ink-300"
        }`}
      >
        {SUIT_GLYPH[suit]}
      </span>

      {CARD_LABELS.map((label) => {
        const rank = LABEL_TO_RANK[label];
        const out = !infinite && remainingByRank[rank] <= 0;
        return (
          <button
            key={`${label}${suit}`}
            type="button"
            disabled={out}
            onClick={() => onPick(label, suit)}
            aria-label={`Deal ${RANK_NAMES[label]} of ${suit === "S" ? "spades" : suit === "H" ? "hearts" : suit === "D" ? "diamonds" : "clubs"} to ${targetLabel}`}
            className={[
              "flex aspect-[2.5/3.5] min-w-7 items-center justify-center rounded border",
              "transition-colors",
              out
                ? "cursor-not-allowed border-felt-800 bg-felt-950/60 opacity-40"
                : "border-face-edge bg-face hover:ring-2 hover:ring-brass-400",
              SUIT_IS_RED[suit] ? "text-face-red" : "text-face-ink",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brass-400",
            ].join(" ")}
          >
            <CardIcon label={label} suit={suit} className="h-5 w-5" />
          </button>
        );
      })}
    </>
  );
}
