import type { ActionEV, ActionKind, Outcome, PreDealOutcome } from "@/lib/blackjack";
import { EvList } from "./ev-list";
import { pct } from "./format";
import { ProbBar } from "./prob-bar";
import { SectionHeading } from "./stat";

/** A labelled pre-deal figure. Two per row, so the pair reads as one fact sheet. */
function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-sans text-[10px] uppercase tracking-wider text-ink-500">
          {label}
        </span>
        <output className="font-mono text-xs tabular-nums text-ink-100">{value}</output>
      </div>
      {hint ? (
        <p className="font-sans text-[9px] leading-none text-ink-500/80">{hint}</p>
      ) : null}
    </div>
  );
}

const NAME: Record<ActionKind, string> = {
  stand: "stand",
  hit: "hit",
  double: "double",
  split: "split",
};
export interface PlayerOddsProps {
  stand: Outcome | null;
  best: Outcome | null;
  bestAction: ActionKind | null;
  actions: Record<ActionKind, ActionEV> | null;
  splitNote?: string;
  /** Pre-deal figures for a full shoe, shown until the hands are dealt. */
  baseline?: PreDealOutcome | null;
  /** True when discards have been entered, which the baseline does not account for. */
  shoeDisturbed?: boolean;
}

export function PlayerOdds({
  stand,
  best,
  bestAction,
  actions,
  splitNote,
  baseline,
  shoeDisturbed,
}: PlayerOddsProps) {
  if (!stand || !actions) {
    if (!baseline) {
      return (
        <div className="flex h-full min-h-32 items-center justify-center rounded-lg border border-dashed border-onyx-700 p-4">
          <p className="text-center font-sans text-xs text-ink-500">
            Deal both hands to see your win odds and the best action.
          </p>
        </div>
      );
    }

    // Centred, not top-aligned: the panel is held at the height of its tallest dealt
    // state, and a short block pinned to the top of that box reads as a hole rather
    // than as breathing room.
    return (
      <div className="my-auto space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <SectionHeading>Before the deal</SectionHeading>
          <span className="font-sans text-[10px] text-ink-500">under best play</span>
        </div>

        <div className="space-y-1.5">
          <ProbBar label="Win" value={baseline.win} tone="win" emphasis />
          <ProbBar label="Push" value={baseline.push} tone="push" />
          <ProbBar label="Loss" value={baseline.loss} tone="loss" />
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-onyx-700/60 pt-2.5">
          {/*
           * Two facts about the deal itself rather than its outcome. They fill a panel
           * that is held at the height of its tallest dealt state, and they are the
           * two things worth knowing before a card is turned: how often the hand is
           * already won, and how often it is the kind with no good answer.
           */}
          <Fact label="Dealt blackjack" value={pct(baseline.natural)} />
          <Fact label="Dealt a stiff" value={pct(baseline.stiff)} hint="hard 12-16" />
        </div>

        <div className="border-t border-onyx-700/60 pt-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
              {baseline.ev < 0 ? "House edge" : "Player edge"}
            </span>
            <output className="font-mono text-sm tabular-nums text-ink-100">
              {pct(Math.abs(baseline.ev))}
            </output>
          </div>
          {/*
           * Stated plainly because these are committed constants, not a live figure:
           * re-deriving them costs a thousand engine evaluations, so they describe a
           * full shoe and cannot follow the discard tracker.
           */}
          <p className="mt-1 font-sans text-[10px] leading-snug text-ink-500">
            {shoeDisturbed
              ? "For a full shoe — these do not track the discards below."
              : "For a full shoe, over one round. Deal a hand for live odds."}
          </p>
        </div>
      </div>
    );
  }

  const showBest = bestAction !== null && bestAction !== "stand" && best !== null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {/*
         * Headed "IF YOU STAND" and sat right above the Stand EV row on purpose.
         * These three numbers describe standing only, so a bare "Win / Push / Loss"
         * above a "BEST: HIT" recommendation reads as self-contradictory.
         */}
        <SectionHeading>If you stand</SectionHeading>
        <div className="space-y-1.5">
          <ProbBar label="Win" value={stand.win} tone="win" emphasis />
          <ProbBar label="Push" value={stand.push} tone="push" />
          <ProbBar label="Loss" value={stand.loss} tone="loss" />
        </div>
      </div>

      {showBest ? (
        <div className="space-y-2">
          <SectionHeading>
            If you {NAME[bestAction]} <span className="text-gold-400">(best)</span>
          </SectionHeading>
          <div className="space-y-1.5">
            <ProbBar label="Win" value={best.win} tone="win" emphasis />
            <ProbBar label="Push" value={best.push} tone="push" />
            <ProbBar label="Loss" value={best.loss} tone="loss" />
          </div>
          {bestAction === "split" && splitNote ? (
            <p className="font-sans text-[10px] leading-snug text-ink-500">{splitNote}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <SectionHeading>Expected value</SectionHeading>
          <span className="font-sans text-[10px] text-ink-500">per unit bet</span>
        </div>
        <EvList actions={actions} best={bestAction} />
      </div>
    </div>
  );
}
