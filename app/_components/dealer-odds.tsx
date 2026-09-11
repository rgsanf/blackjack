import { rankLabel } from "@/lib/blackjack";
import type { DealerOutcomes, RankIndex } from "@/lib/blackjack";
import { pct } from "./format";
import { ProbBar } from "./prob-bar";
import { SectionHeading } from "./stat";

export interface DealerOddsProps {
  outcomes: DealerOutcomes | null;
  upcard: RankIndex | null;
  dealerCardCount: number;
}

export function DealerOdds({ outcomes, upcard, dealerCardCount }: DealerOddsProps) {
  if (!outcomes) {
    return (
      <div className="flex h-full min-h-32 items-center justify-center rounded-lg border border-dashed border-felt-700 p-4">
        <p className="text-center font-sans text-xs text-ink-500">
          Deal the dealer a card to see their final-total odds.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <SectionHeading>Dealer final total</SectionHeading>
        {/* Names what the distribution is conditioned on: with one card it is the
            upcard plus an unknown hole card, with two it is the known total. */}
        <span className="font-sans text-[10px] text-ink-500">
          {dealerCardCount === 1 && upcard !== null
            ? `from showing ${rankLabel(upcard)}`
            : "from the full hand"}
        </span>
      </div>

      <div className="space-y-1.5">
        <ProbBar label="17" value={outcomes.p17} />
        <ProbBar label="18" value={outcomes.p18} />
        <ProbBar label="19" value={outcomes.p19} />
        <ProbBar label="20" value={outcomes.p20} />
        <ProbBar label="21" value={outcomes.p21} />
        {/* Amber, not the player's loss colour: the dealer busting is GOOD for you. */}
        <ProbBar label="Bust" value={outcomes.pBust} tone="bust" emphasis />
      </div>

      <p className="font-sans text-[10px] text-ink-500">
        Dealer busts &mdash; good for you.
      </p>

      {outcomes.pNatural > 0 ? (
        <div className="border-t border-felt-700/60 pt-2.5">
          {/* Deliberately not a bar. The six totals above are mutually exclusive and
              sum to 1, but a blackjack is ALSO a 21 - stacking it with them would
              imply a total over 100%. */}
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
              P(blackjack)
            </span>
            <output className="font-mono text-sm tabular-nums text-bust-400">
              {pct(outcomes.pNatural)}
            </output>
          </div>
          <p className="mt-1 font-sans text-[10px] leading-snug text-ink-500">
            Settled before you act, so the odds above assume no dealer blackjack.
          </p>
        </div>
      ) : null}
    </div>
  );
}
