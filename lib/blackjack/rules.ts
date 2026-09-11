/**
 * Rule set. Frozen and hardcoded per the user's decision ("pay is irrelevant. stand on 17.").
 * Everything here is stated in the UI so no assumption is hidden.
 */
export const RULES = {
  /** Dealer stands on ALL 17s, soft 17 included (S17). */
  dealerHitsSoft17: false,
  /** Natural pays 3:2. */
  blackjackPays: 1.5,
  /** US peek: the dealer checks the hole card before the player acts. */
  dealerPeeks: true,
  doubleAfterSplit: true,
  /** v1 models 2 hands with no resplit. See APPROXIMATIONS. */
  maxSplitHands: 2,
  splitAcesOneCard: true,
  surrender: false,
} as const;

export const RULES_SUMMARY = "S17 · BJ 3:2 · DAS · split to 2, no resplit · no surrender";

export const APPROXIMATIONS = {
  splitNoResplit:
    "Split modelled as 2 hands with no resplit (worth ~0.05% of house edge).",
  splitSiblingIndependence:
    "Split hands priced against the same shoe, ignoring sibling depletion (<2e-4 EV).",
  dealerFirstOrder:
    "Dealer card-removal handled to first order (EV error ~1e-6; exact for double).",
} as const;
