import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CARD_LABELS } from "./palette-data";
import { SUITS, SUIT_IS_RED } from "@/lib/blackjack";
import { CardIcon, hasCardIcon } from "./card-icon";
import { PlayingCard } from "./playing-card";

describe("react-icons card mapping", () => {
  it("resolves a real icon for all 52 cards", () => {
    const missing: string[] = [];
    for (const label of CARD_LABELS) {
      for (const suit of SUITS) {
        if (!hasCardIcon(label, suit)) missing.push(`${label}${suit}`);
      }
    }
    expect(missing).toEqual([]);
    expect(CARD_LABELS.length * SUITS.length).toBe(52);
  });

  /**
   * Guards against a react-icons rename silently blanking the card faces: this fails
   * at test time instead of shipping empty cards.
   */
  it("renders actual svg path data for every card", () => {
    for (const label of CARD_LABELS) {
      for (const suit of SUITS) {
        const html = renderToStaticMarkup(<CardIcon label={label} suit={suit} />);
        expect(html, `${label}${suit}`).toContain("<svg");
        expect(html, `${label}${suit}`).toContain("<path");
        // Colour must come from currentColor so the container's text-* class wins.
        expect(html, `${label}${suit}`).toContain("currentColor");
        // No inline style, which would beat Tailwind and break the red-suit rule.
        expect(html, `${label}${suit}`).not.toContain("style=");
      }
    }
  });

  it("hides the glyph from assistive tech", () => {
    const html = renderToStaticMarkup(<CardIcon label="A" suit="S" />);
    expect(html).toContain('aria-hidden="true"');
  });
});

describe("PlayingCard", () => {
  it("always draws the rank as text, so a card is legible even without its icon", () => {
    const html = renderToStaticMarkup(<PlayingCard label="K" suit="H" />);
    expect(html).toContain("K");
    expect(html).toContain("\u2665");
  });

  it("colours red and black suits differently", () => {
    expect(renderToStaticMarkup(<PlayingCard label="K" suit="H" />)).toContain("text-face-red");
    expect(renderToStaticMarkup(<PlayingCard label="K" suit="S" />)).toContain("text-face-ink");
    expect(SUIT_IS_RED.H).toBe(true);
    expect(SUIT_IS_RED.S).toBe(false);
  });

  it("names the card without its suit for screen readers", () => {
    // Suit affects no number, so announcing it would invite acting on it.
    const html = renderToStaticMarkup(
      <PlayingCard label="K" suit="H" ownerLabel="the dealer's hand" onRemove={() => {}} />,
    );
    expect(html).toContain("Remove king from the dealer&#x27;s hand");
    expect(html).not.toContain("hearts");
  });

  it("renders a non-interactive card as a div, not a button", () => {
    const html = renderToStaticMarkup(<PlayingCard label="K" suit="H" />);
    expect(html.startsWith("<div")).toBe(true);
  });

  it("tags the dealer upcard, which the odds condition on", () => {
    const html = renderToStaticMarkup(<PlayingCard label="A" suit="S" isUpcard />);
    expect(html).toContain(">up<");
  });
});
