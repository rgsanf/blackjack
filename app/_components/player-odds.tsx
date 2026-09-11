import type { ActionEV, ActionKind, Outcome } from "@/lib/blackjack";
import { EvList } from "./ev-list";
import { ProbBar } from "./prob-bar";
import { SectionHeading } from "./stat";

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
}

export function PlayerOdds({
  stand,
  best,
  bestAction,
  actions,
  splitNote,
}: PlayerOddsProps) {
  if (!stand || !actions) {
    return (
      <div className="flex h-full min-h-32 items-center justify-center rounded-lg border border-dashed border-felt-700 p-4">
        <p className="text-center font-sans text-xs text-ink-500">
          Deal both hands to see your win odds and the best action.
        </p>
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
            If you {NAME[bestAction]} <span className="text-brass-400">(best)</span>
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
