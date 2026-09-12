/**
 * Exhaustive pre-deal aggregation: the outcome of one round, summed over every
 * possible opening deal (ordered player pair x dealer upcard) weighted by its exact
 * probability, with the player taking the highest-EV action.
 *
 * This is the generator behind the committed table in `baseline.ts`. It is NOT called
 * at runtime - it makes 1000 engine evaluations and takes over a second at eight
 * decks. It lives in the shipped source rather than a script so the regression test
 * can re-derive the table and prove the constants still match the engine.
 */
import { analyze } from "./analyze";
import { PER_DECK } from "./cards";
import { cardFromLabel } from "./hand";
import type { CardLabel, DeckMode } from "./types";

const RANK_LABELS: CardLabel[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

export interface PreDealOutcome {
  readonly win: number;
  readonly push: number;
  readonly loss: number;
  /** Expected value per unit bet. Negative; its magnitude is the house edge. */
  readonly ev: number;
  /** P(player's two cards are a natural). */
  readonly natural: number;
  /** P(player's two cards are a hard 12-16) - the hands with no good answer. */
  readonly stiff: number;
}

export function preDealOutcome(deck: DeckMode): PreDealOutcome {
  const infinite = deck.kind === "infinite";
  const decks = infinite ? 1 : deck.decks;
  const base = RANK_LABELS.map((_, r) => PER_DECK[r] * decks);
  const total = base.reduce((a, b) => a + b, 0);
  const infP = (r: number) => (r === 9 ? 4 / 13 : 1 / 13);

  let uid = 0;
  let win = 0;
  let push = 0;
  let loss = 0;
  let ev = 0;
  let natural = 0;
  let stiff = 0;

  for (let p1 = 0; p1 < 10; p1++) {
    for (let p2 = 0; p2 < 10; p2++) {
      for (let up = 0; up < 10; up++) {
        let prob: number;
        if (infinite) {
          prob = infP(p1) * infP(p2) * infP(up);
        } else {
          const left = base.slice();
          if (left[p1] <= 0) continue;
          const q1 = left[p1] / total;
          left[p1] -= 1;
          if (left[p2] <= 0) continue;
          const q2 = left[p2] / (total - 1);
          left[p2] -= 1;
          if (left[up] <= 0) continue;
          prob = q1 * q2 * (left[up] / (total - 2));
        }
        if (prob <= 0) continue;

        const res = analyze({
          deck,
          dealerCards: [cardFromLabel(RANK_LABELS[up], uid++, "S")],
          playerCards: [
            cardFromLabel(RANK_LABELS[p1], uid++, "S"),
            cardFromLabel(RANK_LABELS[p2], uid++, "S"),
          ],
        });
        if (res.status !== "ok" || !res.bestAction) continue;

        // Unconditional on the dealer's peek: a dealer natural settles the round before
        // the player acts, pushing only against a player natural.
        const pNat = res.pDealerBlackjack;
        const o = res.outcomes.byAction[res.bestAction]!;
        const pushesNatural = res.player.isNatural ? 1 : 0;

        // Counted here rather than in a separate pass so they share the exact same
        // deal weights as the outcome figures.
        if (res.player.isNatural) natural += prob;
        else if (!res.player.isSoft && res.player.total >= 12 && res.player.total <= 16) {
          stiff += prob;
        }

        win += prob * (1 - pNat) * o.win;
        push += prob * ((1 - pNat) * o.push + pNat * pushesNatural);
        loss += prob * ((1 - pNat) * o.loss + pNat * (1 - pushesNatural));
        ev += prob * res.actions[res.bestAction].unconditionalEV!;
      }
    }
  }

  return { win, push, loss, ev, natural, stiff };
}
