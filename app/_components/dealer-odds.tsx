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

/**
 * Names what the distribution is conditioned on. With no cards it is the pre-deal
 * prior over the whole shoe, with one card the upcard plus an unknown hole card, and
 * with two the known total.
 */
function conditioning(dealerCardCount: number, upcard: RankIndex | null): string {
  if (dealerCardCount === 0) return "before the deal, from the shoe";
  if (dealerCardCount === 1 && upcard !== null) return `from showing ${rankLabel(upcard)}`;
  return "from the full hand";
}

export function DealerOdds({ outcomes, upcard, dealerCardCount }: DealerOddsProps) {
  if (!outcomes) {
    // Only reachable for an impossible shoe, where the invalid banner already explains
    // itself. Every legal state has a dealer distribution, empty hand included.
    return (
      <div className="flex h-full min-h-32 items-center justify-center rounded-lg border border-dashed border-onyx-700 p-4">
        <p className="text-center font-sans text-xs text-ink-500">
          No odds for this shoe.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <SectionHeading>Dealer final total</SectionHeading>
        <span className="font-sans text-[10px] text-ink-500">
          {conditioning(dealerCardCount, upcard)}
        </span>
      </div>

      {dealerCardCount === 0 ? (
        <p className="font-sans text-[10px] leading-snug text-ink-500">
          What the dealer is likely to end on before a card is dealt. Discards and cards
          already in play move these numbers.
        </p>
      ) : null}

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
        <div className="border-t border-onyx-700/60 pt-2.5">
          {/* Deliberately not a bar. The six totals above are mutually exclusive and
              sum to 1, but a blackjack is ALSO a 21 - stacking it with them would
              imply a total over 100%. */}
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
              P(blackjack)
            </span>
            <output className="font-mono text-sm tabular-nums text-loss-300">
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
