import type { Card, HandValue } from "@/lib/blackjack";
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
  onClear: () => void;
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
  onClear,
  children,
}: HandPanelProps) {
  const badge = totalBadge(value);

  return (
    <section
      aria-labelledby={`${hand}-heading`}
      onClick={onActivate}
      className={[
        "relative rounded-xl border p-4 transition-colors",
        // Four simultaneous channels mark the active target, because "which hand am I
        // dealing to" is the highest-frequency question in this UI. The inactive panel
        // is never dimmed - its odds must stay fully readable.
        isActive
          ? "border-brass-400 bg-felt-850 shadow-[0_0_0_1px_var(--color-brass-400),0_0_24px_-6px_#d4af3766]"
          : "border-felt-700 bg-felt-900",
        "before:absolute before:inset-y-3 before:-left-px before:w-0.5 before:rounded-full",
        isActive ? "before:bg-brass-400" : "before:bg-transparent",
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
          </h2>

          {isActive ? (
            <span className="rounded-full border border-brass-400/60 bg-brass-400/10 px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-brass-300">
              &#9670; Dealing here
            </span>
          ) : (
            <button
              type="button"
              onClick={onActivate}
              className="rounded font-sans text-[10px] uppercase tracking-wider text-ink-500 underline decoration-dotted underline-offset-2 hover:text-ink-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-400"
            >
              Deal here
            </button>
          )}

          {cards.length > 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="ml-auto rounded font-sans text-[10px] uppercase tracking-wider text-ink-500 hover:text-loss-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-400"
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col justify-center gap-3">
          <CardRow
            cards={cards}
            emptyHint={`Tap a rank below to deal to the ${label.toLowerCase()}.`}
            ownerLabel={`the ${label.toLowerCase()}'s hand`}
            markUpcard={markUpcard}
            onRemoveCard={onRemoveCard}
          />

          {badge ? (
            <p className="font-mono text-2xl font-semibold tabular-nums text-ink-100">
              {badge}
            </p>
          ) : null}
        </div>

        {warnings && warnings.length > 0 ? (
          <ul className="space-y-1">
            {warnings.map((w) => (
              <li
                key={w}
                className="rounded-md border border-bust-400/40 bg-bust-400/10 px-2.5 py-1.5 font-sans text-[11px] leading-snug text-bust-400"
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

      <div className="min-w-0 rounded-lg bg-felt-950/40 p-3">{children}</div>
    </section>
  );
}
