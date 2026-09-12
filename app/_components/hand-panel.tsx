import type { Card, CardLabel, HandValue, Suit } from "@/lib/blackjack";
import { CardRow } from "./card-row";
import type { TargetHand } from "../_state/types";

export interface HandPanelProps {
  hand: TargetHand;
  label: string;
  cards: Card[];
  value: HandValue | null;
  isActive: boolean;
  markUpcard?: boolean;
  warnings?: string[];
  footnote?: string;
  onActivate: () => void;
  onRemoveCard: (uid: number) => void;
  onPickExact: (label: CardLabel, suit: Suit) => void;
  onClear: () => void;
  remainingByRank: number[];
  infinite: boolean;
  /**
   * Min height for the odds column, sized to that panel's TALLEST state. The panels
   * would otherwise grow and shrink as cards land and clear - the odds stack swings by
   * ~280px between an empty player panel and a split recommendation.
   */
  oddsMinHeight: string;
  children: React.ReactNode;
}

function totalBadge(value: HandValue | null): string | null {
  if (!value || value.cardCount === 0) return null;
  if (value.isBust) return `BUST ${value.total}`;
  if (value.isNatural) return "BLACKJACK";
  return `${value.isSoft ? "SOFT" : "HARD"} ${value.total}`;
}

export function HandPanel({
  hand,
  label,
  cards,
  value,
  isActive,
  markUpcard,
  warnings,
  footnote,
  onActivate,
  onRemoveCard,
  onPickExact,
  onClear,
  remainingByRank,
  infinite,
  oddsMinHeight,
  children,
}: HandPanelProps) {
  const badge = totalBadge(value);

  return (
    <section
      aria-labelledby={`${hand}-heading`}
      onClick={onActivate}
      className={[
        // border-2 on BOTH states, never only the active one: a border that thickens
        // on selection moves every edge by a pixel and changes the panel height, which
        // is the layout shift this panel is built to avoid. Only the colour changes.
        "relative rounded-xl border-2 p-4 transition-colors",
        // Two channels mark the active target - a gold border and a lifted surface -
        // because "which hand am I dealing to" is the highest-frequency question in
        // this UI. The inactive panel is never dimmed: its odds must stay fully
        // readable.
        //
        // Exactly ONE thing draws the outline, and getting there took removing three
        // others: a `0 0 0 1px` ring in the same gold as the border, which read as a
        // single border of double weight; a left rail on top of that, which made one
        // edge heavier than the other three; and a coloured outer glow. Dropping the
        // glow is most of why this stopped looking synthetic - a halo bleeding off a
        // panel edge is the cheapest signal in dark UI, and on near-black a gold
        // border needs no help.
        isActive
          ? "border-gold-400 bg-onyx-850"
          : "border-onyx-700 bg-onyx-900",
        "grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)] md:gap-6",
      ].join(" ")}
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2
            id={`${hand}-heading`}
            className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300"
          >
            {label}
            {/* The active hand is marked visually by border, glow and rail, none of
                which a screen reader can see. This is the same fact in text. */}
            {isActive ? <span className="sr-only"> — dealing here</span> : null}
          </h2>

          {cards.length > 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="ml-auto rounded font-sans text-[10px] uppercase tracking-wider text-ink-500 hover:text-loss-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col justify-center gap-3">
          <CardRow
            cards={cards}
            ownerLabel={`the ${label.toLowerCase()}'s hand`}
            markUpcard={markUpcard}
            remainingByRank={remainingByRank}
            infinite={infinite}
            onRemoveCard={onRemoveCard}
            onPickExact={onPickExact}
            onActivate={onActivate}
          />

          {/*
           * The slot is always rendered, empty hand included. Showing the badge only
           * when a hand exists made both panels jump by a line every time the table
           * was cleared - the single worst bit of movement in the layout. Left blank
           * rather than filled with a dash: a placeholder glyph here reads as a value.
           */}
          <p className="min-h-8 font-mono text-2xl font-semibold tabular-nums text-ink-100 lg:min-h-10 lg:text-3xl">
            {badge}
          </p>
        </div>

        {warnings && warnings.length > 0 ? (
          <ul className="space-y-1">
            {warnings.map((w) => (
              <li
                key={w}
                className="rounded-md border border-warn-400/35 bg-warn-400/10 px-2.5 py-1.5 font-sans text-[11px] leading-snug text-warn-400"
              >
                {w}
              </li>
            ))}
          </ul>
        ) : null}

        {footnote ? (
          <p className="font-sans text-[11px] leading-snug text-ink-500">{footnote}</p>
        ) : null}
      </div>

      <div
        className="flex min-w-0 flex-col rounded-lg bg-onyx-950/40 p-3"
        style={{ minHeight: oddsMinHeight }}
      >
        {children}
      </div>
    </section>
  );
}
