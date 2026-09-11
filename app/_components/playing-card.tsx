import { SUIT_GLYPH, SUIT_IS_RED, RANK_NAMES } from "@/lib/blackjack";
import type { CardLabel, Suit } from "@/lib/blackjack";
import { CardIcon } from "./card-icon";

export interface PlayingCardProps {
  label: CardLabel;
  suit: Suit;
  /** Omit to render a non-interactive card. */
  onRemove?: () => void;
  ownerLabel?: string;
  /** Marks the dealer's first card, whose value is what the odds condition on. */
  isUpcard?: boolean;
  overlap?: boolean;
}

/**
 * A card-shaped container is mandatory rather than decorative: every Game Icons glyph
 * uses a square 512x512 viewBox, so a bare icon has no card silhouette, and a
 * monochrome glyph inheriting currentColor would be invisible on felt. The cream face
 * also decouples the red/black suit convention from the page theme entirely.
 */
export function PlayingCard({
  label,
  suit,
  onRemove,
  ownerLabel,
  isUpcard,
  overlap = true,
}: PlayingCardProps) {
  const red = SUIT_IS_RED[suit];
  const interactive = typeof onRemove === "function";

  const className = [
    "group relative isolate flex shrink-0 items-center justify-center overflow-hidden",
    "rounded-lg border border-face-edge bg-face",
    "w-[var(--card-w)] h-[var(--card-h)]",
    "shadow-[0_1px_2px_rgba(0,0,0,.45),0_6px_14px_-8px_rgba(0,0,0,.6)]",
    "card-lift",
    overlap ? "-ml-5 first:ml-0" : "",
    red ? "text-face-red" : "text-face-ink",
    interactive
      ? [
          "cursor-pointer hover:-translate-y-1.5 hover:z-10",
          // Focus gets the same lift as hover, so a focused card in an overlapping fan
          // is never hidden behind its neighbour.
          "focus-visible:z-10 focus-visible:-translate-y-1.5",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-400",
        ].join(" ")
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const body = (
    <>
      {/* Always text: survives any icon failure, and under overlap this strip is all
          that remains visible of the card. */}
      <span className="absolute left-1 top-0.5 font-mono text-[11px] font-bold leading-none">
        {label}
        <span aria-hidden="true" className="ml-px">
          {SUIT_GLYPH[suit]}
        </span>
      </span>

      <CardIcon label={label} suit={suit} className="h-9 w-9" />

      {isUpcard ? (
        <span
          className="absolute inset-x-0 bottom-0 bg-face-ink/85 py-px text-center text-[8px] font-bold uppercase tracking-widest text-face"
          aria-hidden="true"
        >
          up
        </span>
      ) : null}

      {interactive ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 bg-face-ink/85 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-face opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          remove
        </span>
      ) : null}
    </>
  );

  if (!interactive) {
    return <div className={className}>{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onRemove}
      // Suit is deliberately absent from the accessible name: it affects no number, so
      // announcing it would invite the user to act on it.
      aria-label={`Remove ${RANK_NAMES[label]} from ${ownerLabel ?? "hand"}`}
      className={className}
    >
      {body}
    </button>
  );
}
