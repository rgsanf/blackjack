"use client";

import { Activity, useState } from "react";
import { rankLabel } from "@/lib/blackjack";
import type { RankIndex } from "@/lib/blackjack";
import { shoeCapacity } from "../_state/reducer";
import type { DeckOption } from "../_state/types";

export interface DiscardTrackerProps {
  decks: DeckOption;
  discards: number[];
  remainingByRank: number[];
  inHands: number;
  onAdjust: (rank: RankIndex, delta: number) => void;
  onSet: (rank: RankIndex, count: number) => void;
  onClear: () => void;
}

/**
 * "Cards already seen" - the shoe-composition tracker.
 *
 * The confusion to design against is specific: a `7` in the palette means "a seven is
 * on the table in this hand", while a `7` here means "a seven is gone from the shoe and
 * is not coming back". So this is deliberately presented as INVENTORY, not as cards:
 * flat felt-coloured rank chips with steppers, a different visual genus from the cream
 * card faces above. It also sits collapsed, at the bottom, outside both hand panels.
 */
export function DiscardTracker({
  decks,
  discards,
  remainingByRank,
  inHands,
  onAdjust,
  onSet,
  onClear,
}: DiscardTrackerProps) {
  const [open, setOpen] = useState(false);
  const infinite = decks === "infinite";
  const totalSeen = discards.reduce((a, b) => a + b, 0);
  const capacity = infinite ? 0 : 52 * (decks as number);
  const remaining = capacity - inHands - totalSeen;

  return (
    <section className="rounded-xl border border-felt-700 bg-felt-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass-400"
      >
        <span aria-hidden="true" className="font-mono text-xs text-ink-500">
          {open ? "▾" : "▸"}
        </span>
        <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300">
          Cards already seen
        </span>
        <span className="hidden font-sans text-[10px] text-ink-500 sm:inline">
          not in either hand above
        </span>
        <span className="ml-auto font-mono text-xs tabular-nums text-ink-500">
          {infinite ? "—" : `${totalSeen} removed`}
        </span>
      </button>

      {/*
       * Activity rather than conditional rendering: it hides with display:none while
       * PRESERVING state, so a half-typed count survives collapsing the panel - which
       * matters for something opened, adjusted and closed repeatedly.
       */}
      <Activity mode={open ? "visible" : "hidden"}>
        <div className="space-y-3 border-t border-felt-700 px-4 py-3">
          <p className="font-sans text-[11px] leading-snug text-ink-500">
            Cards removed from the shoe that are <strong>not</strong> in either hand
            above &mdash; other players&rsquo; cards, burns, previous rounds.
          </p>

          {infinite ? (
            <p className="rounded-md border border-felt-700 bg-felt-950/50 px-3 py-2 font-sans text-[11px] text-ink-500">
              Not applicable to an infinite shoe: every draw is with replacement, so
              removing cards changes nothing.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {discards.map((count, r) => {
                  const rank = r as RankIndex;
                  const cap = shoeCapacity(decks, rank);
                  const atMax = remainingByRank[r] <= 0;
                  return (
                    <div
                      key={r}
                      className="w-23 rounded-lg border border-felt-700 bg-felt-950/40 p-1.5 text-center"
                    >
                      <div className="font-mono text-sm font-semibold text-ink-100">
                        {r === 9 ? "10s" : rankLabel(rank)}
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <Stepper
                          label={`One fewer ${r === 9 ? "ten-value card" : rankLabel(rank)} seen`}
                          disabled={count <= 0}
                          onClick={() => onAdjust(rank, -1)}
                        >
                          &minus;
                        </Stepper>
                        <input
                          type="number"
                          min={0}
                          max={cap}
                          inputMode="numeric"
                          value={count}
                          onChange={(e) => onSet(rank, Number(e.target.value))}
                          aria-label={`${r === 9 ? "Ten-value cards" : rankLabel(rank)} already seen`}
                          className="w-7 rounded bg-felt-950 text-center font-mono text-xs tabular-nums text-ink-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <Stepper
                          label={`One more ${r === 9 ? "ten-value card" : rankLabel(rank)} seen`}
                          disabled={atMax}
                          onClick={() => onAdjust(rank, 1)}
                        >
                          &#43;
                        </Stepper>
                      </div>
                      {/* Showing remaining makes double-counting self-evident: put a
                          seven in a hand and this reads 31, not 32. */}
                      <div
                        className={`mt-1 font-mono text-[10px] tabular-nums ${
                          atMax ? "text-loss-400" : "text-ink-500"
                        }`}
                      >
                        {atMax ? "max" : `${remainingByRank[r]} left`}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* A visible equation prevents double-counting better than help text. */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-felt-700/60 pt-2.5">
                <p className="font-mono text-[11px] tabular-nums text-ink-300">
                  {capacity} in shoe &minus; {inHands} in hands &minus; {totalSeen} seen
                  = <span className="text-ink-100">{remaining} remaining</span>
                </p>
                <button
                  type="button"
                  onClick={onClear}
                  disabled={totalSeen === 0}
                  className="rounded font-sans text-[10px] uppercase tracking-wider text-ink-500 transition-colors hover:text-loss-400 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-400"
                >
                  Clear seen cards
                </button>
              </div>
            </>
          )}
        </div>
      </Activity>
    </section>
  );
}

function Stepper({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      // 24px, comfortably smaller than a 44px palette key: reinforces that these are
      // inventory controls, not card buttons.
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-felt-700 bg-felt-800 font-mono text-xs text-ink-300 transition-colors hover:border-brass-400 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brass-400"
    >
      {children}
    </button>
  );
}
