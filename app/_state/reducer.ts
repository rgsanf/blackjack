import { LABEL_TO_RANK, PER_DECK, SUITS, cardFromLabel } from "@/lib/blackjack";
import type { Card, RankIndex } from "@/lib/blackjack";
import type {
  CalculatorAction,
  CalculatorHistory,
  CalculatorState,
  DeckOption,
  TargetHand,
} from "./types";

const MAX_UNDO = 30;
/** Layout guard only; the engine itself tolerates hands of up to 21 cards. */
const MAX_HAND = 12;

export function createInitialState(): CalculatorHistory {
  return {
    decks: 8,
    dealer: [],
    player: [],
    discards: new Array(10).fill(0),
    target: "dealer",
    suitCursor: 0,
    nextId: 1,
    past: [],
  };
}

/** Total of a rank bucket in a full shoe. Infinite mode has no finite supply. */
export function shoeCapacity(decks: DeckOption, rank: RankIndex): number {
  if (decks === "infinite") return Number.POSITIVE_INFINITY;
  return PER_DECK[rank] * decks;
}

function countInHands(state: CalculatorState, rank: RankIndex): number {
  let n = 0;
  for (const c of state.dealer) if (c.rank === rank) n += 1;
  for (const c of state.player) if (c.rank === rank) n += 1;
  return n;
}

/**
 * How many cards of each rank bucket are still unseen. Drives both the disabled state
 * of the palette keys and the discard tracker's clamps, so the UI can never build a
 * hand the shoe could not contain.
 */
export function remainingByRank(state: CalculatorState): number[] {
  const out: number[] = [];
  for (let r = 0; r < 10; r++) {
    const rank = r as RankIndex;
    const cap = shoeCapacity(state.decks, rank);
    out.push(cap - countInHands(state, rank) - state.discards[r]);
  }
  return out;
}

export function totalRemaining(state: CalculatorState): number {
  if (state.decks === "infinite") return Number.POSITIVE_INFINITY;
  return remainingByRank(state).reduce((a, b) => a + b, 0);
}

/** Discard counts expanded into cards, which is what the engine consumes. */
export function discardCards(state: CalculatorState): Card[] {
  const out: Card[] = [];
  let uid = -1;
  for (let r = 0; r < 10; r++) {
    for (let i = 0; i < state.discards[r]; i++) {
      const label = r === 0 ? "A" : r === 9 ? "10" : (String(r + 1) as Card["label"]);
      out.push({ label, rank: r as RankIndex, uid: uid--, suit: "S" });
    }
  }
  return out;
}

function snapshot(state: CalculatorHistory): CalculatorState {
  return {
    decks: state.decks,
    dealer: state.dealer,
    player: state.player,
    discards: state.discards,
    target: state.target,
    suitCursor: state.suitCursor,
    nextId: state.nextId,
  };
}

function withHistory(
  prev: CalculatorHistory,
  next: CalculatorState,
): CalculatorHistory {
  return { ...next, past: [...prev.past, snapshot(prev)].slice(-MAX_UNDO) };
}

/**
 * Reducing 8 decks to 1 can invalidate cards already on the table (you cannot hold
 * three aces from a single deck). Trim hands from the end, then clamp discards, so the
 * state stays legal rather than handing the engine an impossible shoe.
 */
function clampToShoe(next: CalculatorState): CalculatorState {
  if (next.decks === "infinite") return next;

  const used = new Array(10).fill(0);
  const keep = (cards: Card[]): Card[] =>
    cards.filter((c) => {
      if (used[c.rank] + 1 > shoeCapacity(next.decks, c.rank)) return false;
      used[c.rank] += 1;
      return true;
    });

  const dealer = keep(next.dealer);
  const player = keep(next.player);

  const discards = next.discards.map((count, r) => {
    const rank = r as RankIndex;
    const room = shoeCapacity(next.decks, rank) - used[r];
    return Math.max(0, Math.min(count, room));
  });

  return { ...next, dealer, player, discards };
}

export function reducer(
  state: CalculatorHistory,
  action: CalculatorAction,
): CalculatorHistory {
  switch (action.type) {
    case "addCard": {
      const rank = LABEL_TO_RANK[action.label];
      if (remainingByRank(state)[rank] <= 0) return state; // refuse impossible cards
      const hand = state.target;
      if (state[hand].length >= MAX_HAND) return state;

      const suit = action.suit ?? SUITS[state.suitCursor % SUITS.length];
      const card = cardFromLabel(action.label, state.nextId, suit);
      return withHistory(state, {
        ...snapshot(state),
        [hand]: [...state[hand], card],
        // Advance even when an explicit suit was picked, so the cycle stays varied.
        suitCursor: state.suitCursor + 1,
        nextId: state.nextId + 1,
      } as CalculatorState);
    }

    case "removeCard": {
      const hand = action.hand;
      const next = state[hand].filter((c) => c.uid !== action.uid);
      if (next.length === state[hand].length) return state;
      return withHistory(state, { ...snapshot(state), [hand]: next } as CalculatorState);
    }

    case "setTarget":
      if (state.target === action.hand) return state;
      // Not undoable: switching the target changes no numbers.
      return { ...state, target: action.hand };

    case "setDecks": {
      if (state.decks === action.decks) return state;
      return withHistory(
        state,
        clampToShoe({ ...snapshot(state), decks: action.decks }),
      );
    }

    case "adjustDiscard":
    case "setDiscard": {
      if (state.decks === "infinite") return state; // meaningless with replacement
      const rank = action.rank;
      const current = state.discards[rank];
      const want =
        action.type === "adjustDiscard" ? current + action.delta : action.count;
      const room = shoeCapacity(state.decks, rank) - countInHands(state, rank);
      const clamped = Math.max(0, Math.min(Math.floor(want) || 0, room));
      if (clamped === current) return state;
      const discards = state.discards.slice();
      discards[rank] = clamped;
      return withHistory(state, { ...snapshot(state), discards });
    }

    case "clearHand": {
      if (state[action.hand].length === 0) return state;
      return withHistory(state, {
        ...snapshot(state),
        [action.hand]: [],
      } as CalculatorState);
    }

    case "clearDiscards": {
      if (state.discards.every((n) => n === 0)) return state;
      return withHistory(state, { ...snapshot(state), discards: new Array(10).fill(0) });
    }

    case "reset": {
      const fresh = createInitialState();
      return withHistory(state, { ...snapshot(fresh), decks: state.decks });
    }

    case "undo": {
      const prev = state.past[state.past.length - 1];
      if (!prev) return state;
      return { ...prev, past: state.past.slice(0, -1) };
    }

    default:
      return state;
  }
}

export const HAND_LABEL: Record<TargetHand, string> = {
  dealer: "dealer",
  player: "player",
};
