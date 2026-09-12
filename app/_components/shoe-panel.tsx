"use client";

import type { ShoeInfo } from "@/lib/blackjack";
import { oneDecimal, signedCount } from "./format";
import { DECK_OPTIONS, type DeckOption } from "../_state/types";

export interface ShoePanelProps {
  decks: DeckOption;
  shoe: ShoeInfo | null;
  onSetDecks: (decks: DeckOption) => void;
}

export function ShoePanel({ decks, shoe, onSetDecks }: ShoePanelProps) {
  const infinite = decks === "infinite";

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <label className="flex items-center gap-2">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
          Decks
        </span>
        <select
          value={String(decks)}
          onChange={(e) => {
            const v = e.target.value;
            onSetDecks(v === "infinite" ? "infinite" : (Number(v) as DeckOption));
          }}
          className="rounded-lg border border-onyx-700 bg-onyx-800 px-2 py-1 font-mono text-sm text-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
        >
          {DECK_OPTIONS.map((d) => (
            <option key={String(d)} value={String(d)}>
              {d === "infinite" ? "∞" : d}
            </option>
          ))}
        </select>
      </label>

      <Readout
        label="Remaining"
        value={infinite || !shoe ? "—" : String(shoe.remaining)}
        muted={infinite}
      />
      {/*
       * Running and true count are meaningless with replacement, so infinite mode shows
       * an em dash rather than a confidently wrong number. Neutralised rather than
       * hidden, to avoid the panel reflowing when the deck mode changes.
       */}
      <Readout
        label="RC (Hi-Lo)"
        value={infinite || !shoe ? "—" : signedCount(shoe.runningCount)}
        muted={infinite}
      />
      <Readout
        label="True count"
        value={infinite || !shoe ? "—" : oneDecimal(shoe.trueCount)}
        muted={infinite}
        hint={infinite ? undefined : "RC ÷ decks left"}
      />

      {infinite ? (
        <p className="font-sans text-[10px] leading-snug text-ink-500">
          Infinite shoe draws with replacement, so counting does not apply.
        </p>
      ) : null}
    </div>
  );
}

function Readout({
  label,
  value,
  muted,
  hint,
}: {
  label: string;
  value: string;
  muted?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
        {label}
      </span>
      <output
        className={`font-mono text-sm tabular-nums ${muted ? "text-ink-500" : "text-ink-100"}`}
      >
        {value}
      </output>
      {hint ? (
        <span className="hidden font-sans text-[10px] text-ink-500 lg:inline">{hint}</span>
      ) : null}
    </div>
  );
}
