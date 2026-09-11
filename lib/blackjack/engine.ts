import { ACE, TEN } from "./cards";
import { buildShoe, countRemaining } from "./shoe";
import type { EngineContext } from "./memo";
import type { Card, DeckMode, Precision, RankIndex } from "./types";

function emptyMaps(n: number): Map<number, Float64Array>[] {
  const out: Map<number, Float64Array>[] = [];
  for (let i = 0; i < n; i++) out.push(new Map());
  return out;
}

export function createContext(opts: {
  deck: DeckMode;
  dealerRanks: RankIndex[];
  removed: readonly Card[];
  precision: Precision;
}): { ok: true; ctx: EngineContext } | { ok: false; rank: RankIndex } {
  const infinite = opts.deck.kind === "infinite";
  const counts = buildShoe(opts.deck);

  if (!infinite) {
    for (const c of opts.removed) counts[c.rank] -= 1;
    for (let r = 0; r < 10; r++) {
      if (counts[r] < 0) return { ok: false, rank: r as RankIndex };
    }
  }

  const up = opts.dealerRanks.length === 1 ? opts.dealerRanks[0] : null;
  const peekRank: RankIndex | null =
    up === ACE ? TEN : up === TEN ? ACE : null;

  const ctx: EngineContext = {
    counts,
    remaining: countRemaining(counts),
    infinite,
    decks: opts.deck.kind === "infinite" ? null : opts.deck.decks,
    removedCode: 0,
    drawn: new Int32Array(10),
    dealerRanks: opts.dealerRanks,
    precision: opts.precision,
    // Buckets are (total << 1) | soft; the largest reachable is (21 << 1) | 1 = 43.
    dealerMemo: emptyMaps(64),
    hitMemo: emptyMaps(64),
    base: null,
    delta: new Array(10).fill(null),
    peekRank,
    exhausted: false,
    dealerNodes: 0,
    playerNodes: 0,
  };
  return { ok: true, ctx };
}

/** Dev guard: every push must have been matched by a pop before analyze() returns. */
export function assertBalanced(ctx: EngineContext, initialRemaining: number): void {
  if (ctx.removedCode !== 0) {
    throw new Error(`engine leak: removedCode=${ctx.removedCode}`);
  }
  if (!ctx.infinite && ctx.remaining !== initialRemaining) {
    throw new Error(
      `engine leak: remaining=${ctx.remaining} expected ${initialRemaining}`,
    );
  }
  for (let r = 0; r < 10; r++) {
    if (ctx.drawn[r] !== 0) throw new Error(`engine leak: drawn[${r}]=${ctx.drawn[r]}`);
  }
}
