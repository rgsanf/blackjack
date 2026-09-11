import type { ActionEV, ActionKind } from "@/lib/blackjack";
import { ev as fmtEv } from "./format";

/** Fixed order, never sorted by EV: EV-sorted rows would reorder under the cursor. */
const ORDER: ActionKind[] = ["stand", "hit", "double", "split"];

const NAME: Record<ActionKind, string> = {
  stand: "Stand",
  hit: "Hit",
  double: "Double",
  split: "Split",
};

export interface EvListProps {
  actions: Record<ActionKind, ActionEV>;
  best: ActionKind | null;
}

export function EvList({ actions, best }: EvListProps) {
  return (
    <ul className="space-y-1">
      {ORDER.map((kind) => {
        const a = actions[kind];
        const isBest = best === kind && a.available;

        if (!a.available || a.ev === null) {
          // Always render the row, so the list keeps a stable four-row height and never
          // reflows when an action becomes legal or illegal.
          return (
            <li
              key={kind}
              className="flex items-center gap-2 rounded-lg px-3 py-2 opacity-70"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-felt-700" aria-hidden="true" />
              <span className="font-sans text-xs uppercase tracking-wider text-ink-500">
                {NAME[kind]}
              </span>
              <span className="ml-auto font-mono text-sm text-ink-500">&mdash;</span>
              <span className="w-24 shrink-0 text-right font-sans text-[10px] text-ink-500">
                {a.unavailableReason ?? ""}
              </span>
            </li>
          );
        }

        return (
          <li
            key={kind}
            className={
              isBest
                ? "flex items-center gap-2 rounded-lg border border-brass-400 bg-brass-400/10 px-3 py-2"
                : "flex items-center gap-2 rounded-lg border border-transparent px-3 py-2"
            }
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                isBest ? "bg-brass-400" : "bg-felt-700"
              }`}
              aria-hidden="true"
            />
            <span
              className={`font-sans text-xs uppercase tracking-wider ${
                isBest ? "font-semibold text-brass-300" : "text-ink-300"
              }`}
            >
              {NAME[kind]}
            </span>
            <output
              className={`ml-auto font-mono text-sm tabular-nums ${
                isBest ? "font-semibold text-brass-300" : "text-ink-300"
              }`}
            >
              {fmtEv(a.ev)}
            </output>
            <span className="w-24 shrink-0 text-right">
              {/* Three redundant channels for "best" - chip, weight, border - so the
                  recommendation never depends on colour alone. */}
              {isBest ? (
                <span className="rounded bg-brass-400 px-1.5 py-0.5 text-[10px] font-bold uppercase text-felt-950">
                  Best
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
