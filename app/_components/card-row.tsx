import type { Card, CardLabel, Suit } from "@/lib/blackjack";
import { CardPicker } from "./card-picker";
import { PlayingCard } from "./playing-card";

/** Slots drawn when the hand is empty, so it occupies exactly the space a deal will. */
const MIN_SLOTS = 2;

export interface CardRowProps {
  cards: Card[];
  ownerLabel: string;
  markUpcard?: boolean;
  remainingByRank: number[];
  infinite: boolean;
  onRemoveCard: (uid: number) => void;
  onPickExact: (label: CardLabel, suit: Suit) => void;
  /** Makes this the hand being dealt to, before a card is chosen. */
  onActivate: () => void;
}

/**
 * Dashed card outlines standing in for cards not yet dealt, each one a button that
 * opens the exact-card picker for this hand.
 *
 * Deliberately NOT overlapped the way dealt cards are: real cards carry a rank strip
 * that reads through a fan, but two overlapping dashed rectangles just look like one
 * torn shape. Spaced out, they read as "two cards go here".
 */
export function CardRow({
  cards,
  ownerLabel,
  markUpcard,
  remainingByRank,
  infinite,
  onRemoveCard,
  onPickExact,
  onActivate,
}: CardRowProps) {
  // Always at least one, so the picker stays reachable on a hand of any size - a hand
  // of three still needs a way to add a known fourth card.
  const slots = Math.max(MIN_SLOTS - cards.length, 1);

  const slotClass = [
    "ml-2 flex h-[var(--card-h)] w-[var(--card-w)] shrink-0 items-center justify-center first:ml-0",
    "rounded-lg border border-dashed border-onyx-700 text-ink-500",
    "text-[length:calc(var(--card-pip)*0.6)] leading-none",
    "transition-colors hover:border-gold-400 hover:text-gold-400",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400",
  ].join(" ");

  return (
    <div className="flex min-h-[var(--card-h)] flex-wrap items-start gap-y-3 pl-[var(--card-overlap)]">
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

      {Array.from({ length: slots }, (_, i) => (
        <CardPicker
          key={`slot-${i}`}
          targetLabel={ownerLabel}
          remainingByRank={remainingByRank}
          infinite={infinite}
          onPick={onPickExact}
          onOpen={onActivate}
          triggerClassName={slotClass}
          triggerAriaLabel={`Deal an exact card to ${ownerLabel}`}
        >
          <span aria-hidden="true">&#43;</span>
        </CardPicker>
      ))}
    </div>
  );
}
