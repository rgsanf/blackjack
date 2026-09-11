import type { Card } from "@/lib/blackjack";
import { PlayingCard } from "./playing-card";

export interface CardRowProps {
  cards: Card[];
  emptyHint: string;
  ownerLabel: string;
  markUpcard?: boolean;
  onRemoveCard: (uid: number) => void;
}

export function CardRow({
  cards,
  emptyHint,
  ownerLabel,
  markUpcard,
  onRemoveCard,
}: CardRowProps) {
  if (cards.length === 0) {
    return (
      <div className="flex h-[var(--card-h)] items-center">
        <p className="font-sans text-xs text-ink-500">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[var(--card-h)] flex-wrap items-start gap-y-3 pl-5">
      {cards.map((c, i) => (
        <PlayingCard
          key={c.uid}
          label={c.label}
          suit={c.suit}
          isUpcard={markUpcard && i === 0}
          ownerLabel={ownerLabel}
          onRemove={() => onRemoveCard(c.uid)}
        />
      ))}
    </div>
  );
}
