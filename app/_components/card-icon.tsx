import type { IconType } from "react-icons";
import {
  GiCard10Clubs,
  GiCard10Diamonds,
  GiCard10Hearts,
  GiCard10Spades,
  GiCard2Clubs,
  GiCard2Diamonds,
  GiCard2Hearts,
  GiCard2Spades,
  GiCard3Clubs,
  GiCard3Diamonds,
  GiCard3Hearts,
  GiCard3Spades,
  GiCard4Clubs,
  GiCard4Diamonds,
  GiCard4Hearts,
  GiCard4Spades,
  GiCard5Clubs,
  GiCard5Diamonds,
  GiCard5Hearts,
  GiCard5Spades,
  GiCard6Clubs,
  GiCard6Diamonds,
  GiCard6Hearts,
  GiCard6Spades,
  GiCard7Clubs,
  GiCard7Diamonds,
  GiCard7Hearts,
  GiCard7Spades,
  GiCard8Clubs,
  GiCard8Diamonds,
  GiCard8Hearts,
  GiCard8Spades,
  GiCard9Clubs,
  GiCard9Diamonds,
  GiCard9Hearts,
  GiCard9Spades,
  GiCardAceClubs,
  GiCardAceDiamonds,
  GiCardAceHearts,
  GiCardAceSpades,
  GiCardJackClubs,
  GiCardJackDiamonds,
  GiCardJackHearts,
  GiCardJackSpades,
  GiCardKingClubs,
  GiCardKingDiamonds,
  GiCardKingHearts,
  GiCardKingSpades,
  GiCardQueenClubs,
  GiCardQueenDiamonds,
  GiCardQueenHearts,
  GiCardQueenSpades,
} from "react-icons/gi";
import type { CardLabel, Suit } from "@/lib/blackjack";

/**
 * The complete 52-card Game Icons set.
 *
 * Verified by grepping react-icons' published type definitions: `GiCard{Rank}{Suit}`
 * exists for all 13 ranks x 4 suits in both 4.12.0 and 5.7.0 (found=52, missing=0), with
 * the suit segment always plural. So this map needs no gaps and no pip-composition
 * fallback - but see CardIcon below, which still guards the render.
 *
 * Imported by name rather than via a namespace: `react-icons/gi` is a single ~6.9MB
 * barrel with no per-icon entry points, and dynamic property access on a namespace
 * import would defeat both tree-shaking and Next's built-in barrel optimisation,
 * pulling all 4040 icons into the client bundle.
 */
const CARD_ICONS: Record<CardLabel, Record<Suit, IconType>> = {
  A: { S: GiCardAceSpades, H: GiCardAceHearts, D: GiCardAceDiamonds, C: GiCardAceClubs },
  "2": { S: GiCard2Spades, H: GiCard2Hearts, D: GiCard2Diamonds, C: GiCard2Clubs },
  "3": { S: GiCard3Spades, H: GiCard3Hearts, D: GiCard3Diamonds, C: GiCard3Clubs },
  "4": { S: GiCard4Spades, H: GiCard4Hearts, D: GiCard4Diamonds, C: GiCard4Clubs },
  "5": { S: GiCard5Spades, H: GiCard5Hearts, D: GiCard5Diamonds, C: GiCard5Clubs },
  "6": { S: GiCard6Spades, H: GiCard6Hearts, D: GiCard6Diamonds, C: GiCard6Clubs },
  "7": { S: GiCard7Spades, H: GiCard7Hearts, D: GiCard7Diamonds, C: GiCard7Clubs },
  "8": { S: GiCard8Spades, H: GiCard8Hearts, D: GiCard8Diamonds, C: GiCard8Clubs },
  "9": { S: GiCard9Spades, H: GiCard9Hearts, D: GiCard9Diamonds, C: GiCard9Clubs },
  "10": { S: GiCard10Spades, H: GiCard10Hearts, D: GiCard10Diamonds, C: GiCard10Clubs },
  J: { S: GiCardJackSpades, H: GiCardJackHearts, D: GiCardJackDiamonds, C: GiCardJackClubs },
  Q: { S: GiCardQueenSpades, H: GiCardQueenHearts, D: GiCardQueenDiamonds, C: GiCardQueenClubs },
  K: { S: GiCardKingSpades, H: GiCardKingHearts, D: GiCardKingDiamonds, C: GiCardKingClubs },
};

export interface CardIconProps {
  label: CardLabel;
  suit: Suit;
  className?: string;
}

/**
 * Size via className, never the `size` prop, and colour via a `text-*` class on an
 * ancestor, never the `color` prop: react-icons writes width/height as SVG presentation
 * attributes (which CSS overrides) but `color` as an inline style (which would beat a
 * Tailwind class and silently break the red-suit rule).
 */
export function CardIcon({ label, suit, className }: CardIconProps) {
  const Icon = CARD_ICONS[label]?.[suit];

  // Defensive: a renamed or dropped export arrives as undefined, and rendering that
  // throws "Element type is invalid". There is no generic `GiCard` export to fall back
  // on, but none is needed - PlayingCard always draws the rank and suit as text in the
  // corner index, so this degrades to a plain but perfectly legible card.
  if (typeof Icon !== "function") return null;

  return <Icon className={className} aria-hidden="true" focusable="false" />;
}

export function hasCardIcon(label: CardLabel, suit: Suit): boolean {
  return typeof CARD_ICONS[label]?.[suit] === "function";
}
